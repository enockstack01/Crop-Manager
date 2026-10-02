import mongoose from 'mongoose';
import os from 'node:os';
import { clerkClient } from '@clerk/express';
import createHttpError from '../lib/httpError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { serialize } from '../lib/serialize.js';
import { reshape, reshapeMany, toPopulate } from '../lib/shape.js';
import { env } from '../config/env.js';
import { resourceByPath } from '../resources.js';
import { OWNED_MODELS, clearUser, seedUser } from '../lib/seedData.js';
import { getDbAdminEmails, addAdminEmail as addEmail, removeAdminEmail as removeEmail } from '../lib/adminAllowlist.js';
import { STATUS_NOTICES, statusPatch } from '../lib/accountStatus.js';
import * as M from '../models/index.js';

const COUNT_MODELS = OWNED_MODELS.map((model) => [model.modelName, model]);

async function countsFor(userIds) {
  // { user_id: { Farm: n, CropCycle: n, ... } }
  const out = Object.fromEntries(userIds.map((id) => [id, {}]));
  await Promise.all(
    COUNT_MODELS.map(async ([name, Model]) => {
      const rows = await Model.aggregate([
        { $match: { user_id: { $in: userIds } } },
        { $group: { _id: '$user_id', n: { $sum: 1 } } },
      ]);
      for (const r of rows) if (out[r._id]) out[r._id][name] = r.n;
    })
  );
  return out;
}

async function clerkMap(userIds) {
  if (!userIds.length) return {};
  try {
    const list = await clerkClient.users.getUserList({ userId: userIds, limit: userIds.length });
    const users = Array.isArray(list) ? list : list.data;
    return Object.fromEntries(
      users.map((u) => [
        u.id,
        {
          email: u.primaryEmailAddress?.emailAddress || u.emailAddresses?.[0]?.emailAddress || null,
          image_url: u.imageUrl || null,
          clerk_created_at: u.createdAt || null,
          last_active_at: u.lastActiveAt || null,
          banned: !!u.banned,
        },
      ])
    );
  } catch {
    return {};
  }
}

// ---- GET /api/admin/overview ----
export const overview = asyncHandler(async (_req, res) => {
  const [totalUsers, statusAgg, admins, onboarded, recent, pendingRequests, salesAgg, expenseAgg] = await Promise.all([
    M.Profile.countDocuments({}),
    M.Profile.aggregate([{ $group: { _id: '$account_status', n: { $sum: 1 } } }]),
    M.Profile.countDocuments({ is_admin: true }),
    M.Profile.countDocuments({ onboarded: true }),
    M.Profile.find({}).sort({ created_at: -1 }).limit(8).lean(),
    M.Profile.find({ account_status: 'pending' }).sort({ 'access_request.submitted_at': 1 }).limit(10).lean(),
    M.Sale.aggregate([{ $group: { _id: '$currency', total: { $sum: '$total_amount' }, n: { $sum: 1 } } }]),
    M.Expense.aggregate([{ $group: { _id: '$currency', total: { $sum: '$amount' }, n: { $sum: 1 } } }]),
  ]);

  const totals = {};
  await Promise.all(
    COUNT_MODELS.map(async ([name, Model]) => {
      totals[name] = await Model.estimatedDocumentCount();
    })
  );

  const byStatus = Object.fromEntries(statusAgg.map((r) => [r._id || 'new', r.n]));
  const active = byStatus.active || 0;
  res.json({
    users: {
      total: totalUsers,
      active,
      admins,
      onboarded,
      inactive: totalUsers - active,
      pending: byStatus.pending || 0,
      on_hold: byStatus.on_hold || 0,
      rejected: byStatus.rejected || 0,
      deactivated: byStatus.deactivated || 0,
      new: byStatus.new || 0,
    },
    pending_requests: serialize(pendingRequests),
    records: totals,
    finance: {
      // money is never converted: one total per currency
      sales_by_currency: Object.fromEntries(salesAgg.map((r) => [r._id || 'USD', r.total])),
      sales_count: salesAgg.reduce((n, r) => n + r.n, 0),
      expenses_by_currency: Object.fromEntries(expenseAgg.map((r) => [r._id || 'USD', r.total])),
      expenses_count: expenseAgg.reduce((n, r) => n + r.n, 0),
    },
    recent_users: serialize(recent),
  });
});

// ---- GET /api/admin/users ----
export const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage, 10) || 20));
  const q = (req.query.q || '').trim();

  const filter = {};
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ full_name: rx }, { email: rx }, { role: rx }];
  }
  const status = req.query.status;
  if (status === 'admins') filter.is_admin = true;
  else if (status === 'inactive') filter.account_status = { $ne: 'active' };
  else if (M.ACCOUNT_STATUSES.includes(status)) filter.account_status = status;

  const [rows, total] = await Promise.all([
    M.Profile.find(filter).sort({ created_at: -1 }).skip((page - 1) * perPage).limit(perPage).lean(),
    M.Profile.countDocuments(filter),
  ]);

  const ids = rows.map((r) => r.user_id);
  const [counts, clerk] = await Promise.all([countsFor(ids), clerkMap(ids)]);

  const data = serialize(rows).map((p) => ({
    ...p,
    ...clerk[p.user_id],
    counts: counts[p.user_id] || {},
    farms: counts[p.user_id]?.Farm || 0,
    cycles: counts[p.user_id]?.CropCycle || 0,
    harvests: counts[p.user_id]?.HarvestRecord || 0,
  }));

  res.json({ data, page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) });
});

// ---- GET /api/admin/users/:userId ----
export const getUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const profile = await M.Profile.findOne({ user_id: userId }).lean();
  if (!profile) throw createHttpError(404, 'User not found');

  const [counts, clerk] = await Promise.all([countsFor([userId]), clerkMap([userId])]);
  const [harvests, activities] = await Promise.all([
    M.HarvestRecord.find({ user_id: userId }).sort({ harvest_date: -1 }).limit(5).populate('crop_id', 'name').lean(),
    M.FieldActivity.find({ user_id: userId }).sort({ activity_date: -1 }).limit(5).lean(),
  ]);

  res.json({
    ...serialize(profile),
    ...clerk[userId],
    counts: counts[userId] || {},
    recent_harvests: serialize(harvests),
    recent_activities: serialize(activities),
  });
});

// ---- PATCH /api/admin/users/:userId ----
export const updateUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const current = await M.Profile.findOne({ user_id: userId }).lean();
  if (!current) throw createHttpError(404, 'User not found');

  const patch = {};
  for (const key of ['is_admin', 'role']) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }
  // legacy toggle from older clients: is_active true/false → active/deactivated
  let status = req.body.account_status;
  if (status === undefined && req.body.is_active !== undefined) status = req.body.is_active ? 'active' : 'deactivated';
  if (status !== undefined && !Object.keys(STATUS_NOTICES).includes(status)) {
    throw createHttpError(400, `Unknown account status: ${status}`);
  }

  if (userId === req.userId && (patch.is_admin === false || (status && status !== 'active'))) {
    throw createHttpError(400, 'You cannot revoke your own admin access or change your own account status');
  }

  const changedStatus = status !== undefined && status !== current.account_status;
  if (changedStatus) {
    Object.assign(patch, statusPatch(status, req.userId, String(req.body.reason || '').trim().slice(0, 500)));
    // the first approval grants the account type the user asked for (unless the admin set one)
    if (status === 'active' && !current.approved_at) {
      patch.approved_at = new Date();
      if (!patch.role && current.access_request?.account_type) patch.role = current.access_request.account_type;
    }
  }
  if (patch.is_admin === true) Object.assign(patch, statusPatch('active', req.userId));

  const profile = await M.Profile.findOneAndUpdate({ user_id: userId }, { $set: patch }, { new: true }).lean();

  if (changedStatus) {
    const notice = STATUS_NOTICES[status];
    const reason = profile.status_reason ? ` Reason: ${profile.status_reason}` : '';
    await M.Notification.create({ user_id: userId, type: notice.type, title: notice.title, message: notice.message + reason });
  }
  res.json(serialize(profile));
});

// ---- DELETE /api/admin/users/:userId ----
export const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (userId === req.userId) throw createHttpError(400, 'You cannot delete your own account here');

  const deletedDocs = await clearUser(userId);
  await M.Profile.deleteOne({ user_id: userId });
  let clerkDeleted = false;
  try {
    await clerkClient.users.deleteUser(userId);
    clerkDeleted = true;
  } catch {
    /* Clerk user may already be gone */
  }

  res.json({ user_id: userId, deleted: true, documents_removed: deletedDocs, clerk_user_deleted: clerkDeleted });
});

// ---- GET /api/admin/data/:resource ----
export const browseResource = asyncHandler(async (req, res) => {
  const resource = resourceByPath[req.params.resource];
  if (!resource) throw createHttpError(404, `Unknown resource: ${req.params.resource}`);

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage, 10) || 20));
  const filter = {};
  if (req.query.userId) filter.user_id = req.query.userId;
  const q = (req.query.q || '').trim();
  if (q && (resource.search || []).length) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = resource.search.map((f) => ({ [f]: rx }));
  }

  const populate = toPopulate(resource.relations || []);
  let query = resource.model.find(filter).sort({ created_at: -1 }).skip((page - 1) * perPage).limit(perPage);
  if (populate.length) query = query.populate(populate);
  const [rows, total] = await Promise.all([query.lean(), resource.model.countDocuments(filter)]);

  const data = reshapeMany(serialize(rows), resource.relations || []);
  // attach owner name/email
  const ownerIds = [...new Set(data.map((r) => r.user_id))];
  const owners = await M.Profile.find({ user_id: { $in: ownerIds } }, 'user_id full_name email').lean();
  const ownerMap = Object.fromEntries(owners.map((o) => [o.user_id, { full_name: o.full_name, email: o.email }]));
  for (const r of data) r.owner = ownerMap[r.user_id] || null;

  res.json({ data, page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)), resource: resource.path });
});

export const resourceList = asyncHandler(async (_req, res) => {
  res.json(Object.values(resourceByPath).map((r) => ({ path: r.path, name: r.name })));
});

// ---- GET /api/admin/data/:resource/:id ----
export const getRecord = asyncHandler(async (req, res) => {
  const resource = resourceByPath[req.params.resource];
  if (!resource) throw createHttpError(404, `Unknown resource: ${req.params.resource}`);

  const populate = toPopulate(resource.relations || []);
  let query = resource.model.findById(req.params.id);
  if (populate.length) query = query.populate(populate);
  const doc = await query.lean();
  if (!doc) throw createHttpError(404, 'Record not found');

  const shaped = reshape(serialize(doc), resource.relations || []);
  const owner = await M.Profile.findOne({ user_id: shaped.user_id }, 'user_id full_name email').lean();
  res.json({ ...shaped, owner: owner ? { full_name: owner.full_name, email: owner.email } : null });
});

// ---- DELETE /api/admin/data/:resource/:id ----
export const deleteRecord = asyncHandler(async (req, res) => {
  const resource = resourceByPath[req.params.resource];
  if (!resource) throw createHttpError(404, `Unknown resource: ${req.params.resource}`);
  const doc = await resource.model.findByIdAndDelete(req.params.id);
  if (!doc) throw createHttpError(404, 'Record not found');
  res.json({ id: req.params.id, resource: resource.path, deleted: true });
});

// ---- POST /api/admin/users/:userId/reseed ----
export const reseedUser = asyncHandler(async (req, res) => {
  const profile = await M.Profile.findOne({ user_id: req.params.userId }).lean();
  if (!profile) throw createHttpError(404, 'User not found');
  const counts = await seedUser(req.params.userId, {
    profile: { full_name: profile.full_name, role: profile.role, location: profile.location, phone: profile.phone },
  });
  res.json({ user_id: req.params.userId, counts, total: Object.values(counts).reduce((s, n) => s + n, 0) });
});

// ---- GET /api/admin/settings ----
export const getSettings = asyncHandler(async (_req, res) => {
  const conn = mongoose.connection;
  const [dbStats, dbAdmins, collectionCounts] = await Promise.all([
    conn.db.stats().catch(() => null),
    getDbAdminEmails(),
    Promise.all(
      OWNED_MODELS.concat([M.Profile, M.SystemSetting]).map(async (Model) => [
        Model.modelName,
        await Model.estimatedDocumentCount().catch(() => 0),
      ])
    ),
  ]);

  res.json({
    app: {
      version: process.env.npm_package_version || '2.0.0',
      node: process.version,
      env: env.nodeEnv,
      uptime_seconds: Math.round(process.uptime()),
      host: os.hostname(),
    },
    database: {
      name: conn.name,
      state: ['disconnected', 'connected', 'connecting', 'disconnecting'][conn.readyState] || String(conn.readyState),
      collections: dbStats?.collections ?? null,
      documents: dbStats?.objects ?? null,
      data_size_mb: dbStats ? +(dbStats.dataSize / 1048576).toFixed(2) : null,
      storage_size_mb: dbStats ? +(dbStats.storageSize / 1048576).toFixed(2) : null,
    },
    collection_counts: Object.fromEntries(collectionCounts),
    admin_allowlist: {
      env: env.adminEmails, // immutable, from server/.env
      managed: dbAdmins, // editable here
    },
  });
});

// ---- POST /api/admin/settings/admins  { email } ----
export const addAdminEmail = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw createHttpError(400, 'Enter a valid email address');
  const managed = await addEmail(email, req.userId);
  // if that user already signed up, promote them now
  await M.Profile.updateOne({ email }, { $set: { is_admin: true, ...statusPatch('active', req.userId) } });
  res.json({ managed });
});

// ---- DELETE /api/admin/settings/admins/:email ----
export const removeAdminEmail = asyncHandler(async (req, res) => {
  const email = decodeURIComponent(req.params.email).trim().toLowerCase();
  if (env.adminEmails.includes(email)) {
    throw createHttpError(400, 'This admin is configured in server/.env and cannot be removed here');
  }
  const managed = await removeEmail(email, req.userId);
  res.json({ managed });
});
