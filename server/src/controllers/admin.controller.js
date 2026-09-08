import { clerkClient } from '@clerk/express';
import createHttpError from '../lib/httpError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { serialize } from '../lib/serialize.js';
import { reshapeMany, toPopulate } from '../lib/shape.js';
import { resourceByPath } from '../resources.js';
import { OWNED_MODELS, clearUser } from '../lib/seedData.js';
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
  const [totalUsers, activeUsers, admins, onboarded, recent, salesAgg, expenseAgg] = await Promise.all([
    M.Profile.countDocuments({}),
    M.Profile.countDocuments({ is_active: { $ne: false } }),
    M.Profile.countDocuments({ is_admin: true }),
    M.Profile.countDocuments({ onboarded: true }),
    M.Profile.find({}).sort({ created_at: -1 }).limit(8).lean(),
    M.Sale.aggregate([{ $group: { _id: null, total: { $sum: '$total_amount' }, n: { $sum: 1 } } }]),
    M.Expense.aggregate([{ $group: { _id: null, total: { $sum: '$amount' }, n: { $sum: 1 } } }]),
  ]);

  const totals = {};
  await Promise.all(
    COUNT_MODELS.map(async ([name, Model]) => {
      totals[name] = await Model.estimatedDocumentCount();
    })
  );

  res.json({
    users: { total: totalUsers, active: activeUsers, admins, onboarded, inactive: totalUsers - activeUsers },
    records: totals,
    finance: {
      sales_total: salesAgg[0]?.total || 0,
      sales_count: salesAgg[0]?.n || 0,
      expenses_total: expenseAgg[0]?.total || 0,
      expenses_count: expenseAgg[0]?.n || 0,
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
  if (req.query.status === 'active') filter.is_active = { $ne: false };
  if (req.query.status === 'inactive') filter.is_active = false;
  if (req.query.status === 'admins') filter.is_admin = true;

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
  const patch = {};
  for (const key of ['is_admin', 'is_active', 'role']) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }

  if (userId === req.userId && (patch.is_admin === false || patch.is_active === false)) {
    throw createHttpError(400, 'You cannot revoke your own admin or active status');
  }

  const profile = await M.Profile.findOneAndUpdate({ user_id: userId }, { $set: patch }, { new: true }).lean();
  if (!profile) throw createHttpError(404, 'User not found');
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
