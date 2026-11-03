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
import { getLimits, setLimits, usageSummary } from '../lib/ai/usage.js';
import { audit, detachFarmer } from '../lib/orgs/core.js';
import { removeUploadsOf } from '../routes/uploads.routes.js';

const ROLES = ['Farmer', 'Farm Manager', 'Agronomist', 'Cooperative Manager', 'Administrator'];
const emailKey = (e) => String(e || '').trim().toLowerCase();
const exactEmail = (e) => new RegExp(`^${String(e).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
/** Other administrators who can still sign in. The platform must never be left without one. */
const otherAdmins = (exceptUserId) => M.Profile.countDocuments({ is_admin: true, user_id: { $ne: exceptUserId }, account_status: 'active' });


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
    filter.$or = [{ full_name: rx }, { email: rx }, { role: rx }, { public_id: rx }];
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

  await audit(req, 'user.viewed', { target_type: 'user', target_id: userId });
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
  const b = req.body || {};
  const patch = {};
  const events = []; // written to the audit log once the change is saved

  if (b.role !== undefined) {
    if (!ROLES.includes(b.role)) throw createHttpError(400, `Unknown account type: ${b.role}`);
    if (b.role !== current.role) {
      patch.role = b.role;
      events.push(['user.role_changed', { from: current.role, to: b.role }]);
    }
  }

  if (b.is_admin !== undefined) {
    if (typeof b.is_admin !== 'boolean') throw createHttpError(400, 'is_admin must be true or false');
    if (b.is_admin !== !!current.is_admin) {
      if (userId === req.userId) throw createHttpError(400, 'You cannot change your own admin access');
      if (b.is_admin === false) {
        if (!(await otherAdmins(userId))) {
          throw createHttpError(400, 'This is the last administrator. Make someone else an administrator first.', { code: 'last_admin' });
        }
        const mail = emailKey(current.email);
        if (mail && env.adminEmails.includes(mail)) {
          throw createHttpError(400, 'This administrator is set in the server settings (ADMIN_EMAILS). Remove the email there first, then revoke the access.', { code: 'admin_in_env' });
        }
        // an address on the managed list would grant admin again at the next sign-in
        if (mail && (await getDbAdminEmails()).includes(mail)) await removeEmail(mail, req.userId);
      }
      patch.is_admin = b.is_admin;
      events.push([b.is_admin ? 'user.admin_granted' : 'user.admin_revoked', {}]);
    }
  }

  if (b.ai_daily_limit !== undefined) {
    const v = b.ai_daily_limit;
    let next;
    if (v === null || v === '') next = null; // back to the platform default
    else if (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 10000) next = Number(v);
    else throw createHttpError(400, 'AI requests per day must be a whole number from 0 to 10000');
    if (next !== (current.ai_daily_limit ?? null)) {
      patch.ai_daily_limit = next;
      events.push(['user.ai_limit_changed', { from: current.ai_daily_limit ?? null, to: next }]);
    }
  }

  // legacy toggle from older clients: is_active true/false -> active/deactivated
  let status = b.account_status;
  if (status === undefined && b.is_active !== undefined) status = b.is_active ? 'active' : 'deactivated';
  if (status !== undefined && !Object.keys(STATUS_NOTICES).includes(status)) {
    throw createHttpError(400, `Unknown account status: ${status}`);
  }
  if (userId === req.userId && status && status !== 'active') {
    throw createHttpError(400, 'You cannot change your own account status');
  }
  if (status && status !== 'active' && current.is_admin && patch.is_admin !== false) {
    throw createHttpError(400, 'Administrators always have access. Revoke their admin access first.');
  }

  const changedStatus = status !== undefined && status !== current.account_status;
  if (changedStatus) {
    Object.assign(patch, statusPatch(status, req.userId, String(b.reason || '').trim().slice(0, 500)));
    // the first approval grants the account type the user asked for (unless the admin set one)
    if (status === 'active' && !current.approved_at) {
      patch.approved_at = new Date();
      if (!patch.role && current.access_request?.account_type) patch.role = current.access_request.account_type;
    }
  }
  if (patch.is_admin === true) Object.assign(patch, statusPatch('active', req.userId));

  const profile = await M.Profile.findOneAndUpdate({ user_id: userId }, { $set: patch }, { new: true }).lean();

  for (const [action, details] of events) await audit(req, action, { target_type: 'user', target_id: userId, details });
  if (changedStatus) {
    await audit(req, 'user.status_changed', { target_type: 'user', target_id: userId, details: { from: current.account_status, to: status, reason: profile.status_reason || '' } });
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
  const target = await M.Profile.findOne({ user_id: userId }, 'is_admin email full_name public_id').lean();
  if (target?.is_admin) throw createHttpError(400, 'Revoke this administrator\'s access before deleting the account.', { code: 'admin_account' });

  // leave no dangling organization links behind (the farmer count of their organization goes down)
  await detachFarmer({ farmerId: userId, status: 'removed', by: req.userId, reason: 'account deleted' });
  await M.OrganizationMember.updateMany({ user_id: userId }, { $set: { status: 'removed' } });
  await audit(req, 'user.deleted', { target_type: 'user', target_id: userId, details: { name: target?.full_name || '', email: target?.email || '', public_id: target?.public_id || '' } });
  const deletedDocs = await clearUser(userId);
  const picturesRemoved = await removeUploadsOf(userId); // the pictures go with the account
  await M.Profile.deleteOne({ user_id: userId });
  let clerkDeleted = false;
  try {
    await clerkClient.users.deleteUser(userId);
    clerkDeleted = true;
  } catch {
    /* Clerk user may already be gone */
  }

  res.json({ user_id: userId, deleted: true, documents_removed: deletedDocs, pictures_removed: picturesRemoved, clerk_user_deleted: clerkDeleted });
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
  await audit(req, 'data.record_viewed', { target_type: resource.path, target_id: req.params.id, details: { owner: shaped.user_id } });
  const owner = await M.Profile.findOne({ user_id: shaped.user_id }, 'user_id full_name email').lean();
  res.json({ ...shaped, owner: owner ? { full_name: owner.full_name, email: owner.email } : null });
});

// ---- DELETE /api/admin/data/:resource/:id ----
export const deleteRecord = asyncHandler(async (req, res) => {
  const resource = resourceByPath[req.params.resource];
  if (!resource) throw createHttpError(404, `Unknown resource: ${req.params.resource}`);
  const doc = await resource.model.findByIdAndDelete(req.params.id);
  if (!doc) throw createHttpError(404, 'Record not found');
  await audit(req, 'data.record_deleted', { target_type: resource.path, target_id: req.params.id, details: { owner: doc.user_id } });
  res.json({ id: req.params.id, resource: resource.path, deleted: true });
});

// ---- POST /api/admin/users/:userId/reseed ----
export const reseedUser = asyncHandler(async (req, res) => {
  const profile = await M.Profile.findOne({ user_id: req.params.userId }).lean();
  if (!profile) throw createHttpError(404, 'User not found');
  const counts = await seedUser(req.params.userId, {
    profile: { full_name: profile.full_name, role: profile.role, location: profile.location, phone: profile.phone },
  });
  await audit(req, 'user.reseeded', { target_type: 'user', target_id: req.params.userId });
  res.json({ user_id: req.params.userId, counts, total: Object.values(counts).reduce((s, n) => s + n, 0) });
});

// ---- GET /api/admin/settings ----
export const getSettings = asyncHandler(async (_req, res) => {
  const [aiLimits, aiToday] = await Promise.all([getLimits(), usageSummary()]);
  const topProfiles = await M.Profile.find({ user_id: { $in: aiToday.top.map((x) => x.user_id) } }, 'user_id email full_name').lean();
  aiToday.top = aiToday.top.map((x) => {
    const p = topProfiles.find((q) => q.user_id === x.user_id);
    return { ...x, name: p?.full_name || p?.email || x.user_id };
  });
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
    ai: { limits: aiLimits, today: aiToday },
    collection_counts: Object.fromEntries(collectionCounts),
    admin_allowlist: {
      env: env.adminEmails, // immutable, from server/.env
      managed: dbAdmins, // editable here
    },
  });
});

// ---- PUT /api/admin/settings/ai-limits  { daily, hourly } ----
export const setAiLimits = asyncHandler(async (req, res) => {
  const daily = Number(req.body.daily);
  const hourly = Number(req.body.hourly);
  const ok = (v) => Number.isInteger(v) && v >= 0 && v <= 10000;
  if (!ok(daily) || !ok(hourly)) throw createHttpError(400, 'Limits must be whole numbers from 0 to 10000');
  if (hourly > daily) throw createHttpError(400, 'The hourly limit cannot be higher than the daily limit');
  const before = await getLimits();
  const after = await setLimits({ daily, hourly }, req.userId);
  await audit(req, 'ai.limits_updated', { target_type: 'ai_limits', details: { before, after } });
  res.json(after);
});

// ---- POST /api/admin/settings/admins  { email } ----
export const addAdminEmail = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw createHttpError(400, 'Enter a valid email address');
  const managed = await addEmail(email, req.userId);
  // if that person already signed up with this verified address, promote them now
  const promoted = await M.Profile.updateOne({ email: exactEmail(email), email_verified: true }, { $set: { is_admin: true, ...statusPatch('active', req.userId) } });
  await audit(req, 'admin_allowlist.added', { target_type: 'admin_email', target_id: email, details: { promoted_now: promoted.modifiedCount > 0 } });
  res.json({ managed });
});

// ---- DELETE /api/admin/settings/admins/:email ----
export const removeAdminEmail = asyncHandler(async (req, res) => {
  const email = decodeURIComponent(req.params.email).trim().toLowerCase();
  if (env.adminEmails.includes(email)) {
    throw createHttpError(400, 'This admin is configured in server/.env and cannot be removed here');
  }
  // taking an address off the list also ends that person's administrator access, unless it would leave none
  const target = await M.Profile.findOne({ email: exactEmail(email), is_admin: true }, 'user_id').lean();
  if (target) {
    if (target.user_id === req.userId) throw createHttpError(400, 'You cannot remove your own administrator access');
    if (!(await otherAdmins(target.user_id))) throw createHttpError(400, 'This is the last administrator. Make someone else an administrator first.', { code: 'last_admin' });
  }
  const managed = await removeEmail(email, req.userId);
  if (target) {
    await M.Profile.updateOne({ user_id: target.user_id }, { $set: { is_admin: false } });
    await audit(req, 'user.admin_revoked', { target_type: 'user', target_id: target.user_id, details: { via: 'admin_list' } });
  }
  await audit(req, 'admin_allowlist.removed', { target_type: 'admin_email', target_id: email });
  res.json({ managed });
});
