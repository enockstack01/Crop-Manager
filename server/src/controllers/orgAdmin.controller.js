import createHttpError from '../lib/httpError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { statusPatch } from '../lib/accountStatus.js';
import {
  AuditLog, Farm, FarmerOrganization, Organization, OrganizationMember, Profile, ReferralLink,
} from '../models/index.js';
import {
  attachFarmer, audit, getOrgSettings, notifyUsers, orgAdminIds, orgView, setOrgSettings, joinError,
} from '../lib/orgs/core.js';

const str = (v, max = 200) => (v === undefined || v === null ? '' : String(v).trim().slice(0, max));
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const AREA = { hectares: 1, acres: 0.404686, 'square metres': 0.0001 };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ------------------------------------------------------------------- list */
export const listOrganizations = asyncHandler(async (req, res) => {
  const { status, q } = req.query;
  const filter = {};
  if (['pending', 'active', 'suspended'].includes(status)) filter.status = status;
  if (q) filter.name = new RegExp(esc(String(q).slice(0, 80)), 'i');
  const [rows, counts, memberCounts] = await Promise.all([
    Organization.find(filter).sort({ created_at: -1 }).lean(),
    Organization.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    OrganizationMember.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$organization_id', n: { $sum: 1 } } }]),
  ]);
  const members = Object.fromEntries(memberCounts.map((m) => [String(m._id), m.n]));
  res.json({
    data: rows.map((o) => ({ ...orgView(o), members: members[String(o._id)] || 0, usage_pct: o.max_farmers > 0 ? Math.round((o.farmer_count / o.max_farmers) * 100) : 100 })),
    counts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
  });
});

export const getOrganizationAdmin = asyncHandler(async (req, res) => {
  const org = req.org;
  // the stored counter is what the limit uses; show and repair any drift from the real rows
  const real = await FarmerOrganization.countDocuments({ organization_id: org._id, status: 'active' });
  if (real !== org.farmer_count) {
    const old = org.farmer_count;
    org.farmer_count = real;
    await org.save();
    await audit(req, 'organization.recount', { target_type: 'organization', target_id: org._id, organization_id: org._id, details: { old, new: real } });
  }
  const [members, links, recent] = await Promise.all([
    OrganizationMember.find({ organization_id: org._id, status: { $in: ['active', 'invited'] } }).lean(),
    ReferralLink.find({ organization_id: org._id }).sort({ created_at: -1 }).limit(20).lean(),
    AuditLog.find({ organization_id: org._id }).sort({ created_at: -1 }).limit(15).lean(),
  ]);
  const profiles = await Profile.find({ user_id: { $in: members.map((m) => m.user_id).filter(Boolean) } }, 'user_id full_name email').lean();
  const by = Object.fromEntries(profiles.map((p) => [p.user_id, p]));
  res.json({
    ...orgView(org),
    members: members.map((m) => ({ id: String(m._id), role: m.role, status: m.status, name: by[m.user_id]?.full_name || '', email: by[m.user_id]?.email || m.invited_email || '' })),
    links: links.map((l) => ({
      id: String(l._id), label: l.label, created_at: l.created_at, expires_at: l.expires_at, max_uses: l.max_uses, use_count: l.use_count,
      status: l.revoked_at ? 'revoked' : l.expires_at <= new Date() ? 'expired' : l.max_uses != null && l.use_count >= l.max_uses ? 'full' : 'active',
    })),
    audit: recent.map((a) => ({ id: String(a._id), action: a.action, actor: a.actor_name, created_at: a.created_at, details: a.details })),
  });
});

/* ----------------------------------------------------------------- create */
export const createOrganizationAdmin = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 160);
  if (!name) throw createHttpError(400, 'Enter the organization name');
  if (await Organization.exists({ name_key: name.toLowerCase() })) throw createHttpError(409, 'An organization with this name already exists.', { code: 'name_taken' });
  const email = str(b.admin_email, 160).toLowerCase();
  if (email && !isEmail(email)) throw createHttpError(400, 'Enter a valid email for the organization administrator');
  const settings = await getOrgSettings();
  const max = b.max_farmers === undefined || b.max_farmers === '' ? settings.default_max_farmers : Number(b.max_farmers);
  if (!Number.isInteger(max) || max < 0) throw createHttpError(400, 'The farmer limit must be a whole number of 0 or more');
  const org = await Organization.create({
    name, name_key: name.toLowerCase(),
    type: ['Cooperative', 'NGO', 'Company', 'Government', 'Other'].includes(b.type) ? b.type : 'Other',
    country: str(b.country, 100), district: str(b.district, 100), sector: str(b.sector, 100),
    contact_email: str(b.contact_email, 160) || email, contact_phone: str(b.contact_phone, 40),
    status: 'active', max_farmers: max, created_by: req.userId, approved_by: req.userId, approved_at: new Date(),
  });
  if (email) await OrganizationMember.create({ organization_id: org._id, invited_email: email, role: 'org_admin', status: 'invited' });
  await audit(req, 'organization.created', { target_type: 'organization', target_id: org._id, organization_id: org._id, details: { name, max_farmers: max, admin_email: email } });
  res.status(201).json(orgView(org));
});

/* ----------------------------------------------------------------- update */
// PATCH /api/admin/organizations/:orgId  { action: approve | suspend | reactivate, max_farmers, reason }
export const updateOrganizationAdmin = asyncHandler(async (req, res) => {
  const org = req.org;
  const { action, reason } = req.body || {};
  const why = str(reason, 300);
  const adminIds = await orgAdminIds(org._id);

  if (req.body?.max_farmers !== undefined) {
    const next = Number(req.body.max_farmers);
    if (!Number.isInteger(next) || next < 0 || next > 1_000_000) throw createHttpError(400, 'The farmer limit must be a whole number of 0 or more');
    if (next !== org.max_farmers) {
      if (!why) throw createHttpError(400, 'Enter the reason for changing the farmer limit', { code: 'reason_required' });
      const old = org.max_farmers;
      org.max_farmers = next;
      // the 80 and 100 percent notices start again against the new limit
      if (org.farmer_count < next * 0.8) org.notified_80 = false;
      if (org.farmer_count < next) org.notified_100 = false;
      await org.save();
      await audit(req, 'organization.limit_changed', { target_type: 'organization', target_id: org._id, organization_id: org._id, details: { old, new: next, reason: why } });
      await notifyUsers(adminIds, { type: 'info', title: 'Farmer limit changed', message: `The farmer limit for ${org.name} is now ${next} (was ${old}).` });
    }
  }

  if (action === 'approve') {
    if (org.status !== 'pending') throw createHttpError(400, 'Only a pending organization can be approved');
    org.status = 'active';
    org.approved_by = req.userId;
    org.approved_at = new Date();
    await org.save();
    await audit(req, 'organization.approved', { target_type: 'organization', target_id: org._id, organization_id: org._id, details: { max_farmers: org.max_farmers } });
    await notifyUsers(adminIds, { type: 'success', title: 'Organization approved', message: `${org.name} is active. You can now create referral links. Your farmer limit is ${org.max_farmers}.` });
  } else if (action === 'suspend') {
    if (org.status !== 'active') throw createHttpError(400, 'Only an active organization can be suspended');
    org.status = 'suspended';
    org.suspended_reason = why;
    await org.save();
    await audit(req, 'organization.suspended', { target_type: 'organization', target_id: org._id, organization_id: org._id, details: { reason: why } });
    await notifyUsers(adminIds, { type: 'danger', title: 'Organization suspended', message: `${org.name} has been suspended. Referral links no longer work and you can view data but not change it.${why ? ` Reason: ${why}` : ''}` });
  } else if (action === 'reactivate') {
    if (org.status !== 'suspended') throw createHttpError(400, 'Only a suspended organization can be reactivated');
    org.status = 'active';
    org.suspended_reason = '';
    await org.save();
    await audit(req, 'organization.reactivated', { target_type: 'organization', target_id: org._id, organization_id: org._id });
    await notifyUsers(adminIds, { type: 'success', title: 'Organization reactivated', message: `${org.name} is active again.` });
  } else if (action) {
    throw createHttpError(400, 'Unknown action');
  }
  res.json(orgView(org));
});

export const deleteOrganizationAdmin = asyncHandler(async (req, res) => {
  const org = req.org;
  const memberRows = await OrganizationMember.find({ organization_id: org._id, status: 'active' }, 'user_id').lean();
  const farmers = await FarmerOrganization.find({ organization_id: org._id, status: 'active' }, 'farmer_id').lean();
  await FarmerOrganization.updateMany({ organization_id: org._id, status: 'active' }, { $set: { status: 'removed', ended_at: new Date(), ended_by: req.userId, end_reason: 'organization deleted' } });
  await ReferralLink.updateMany({ organization_id: org._id, revoked_at: null }, { $set: { revoked_at: new Date() } });
  await OrganizationMember.updateMany({ organization_id: org._id }, { $set: { status: 'removed' } });
  await Organization.deleteOne({ _id: org._id });
  await audit(req, 'organization.deleted', { target_type: 'organization', target_id: org._id, organization_id: null, details: { name: org.name, farmers_unlinked: farmers.length } });
  await notifyUsers(farmers.map((f) => f.farmer_id), { type: 'info', title: 'Organization removed', message: `${org.name} is no longer on CropManager, so it is no longer linked to your account. Your farm data is unchanged.` });
  await notifyUsers(memberRows.map((m) => m.user_id), { type: 'danger', title: 'Organization removed', message: `${org.name} has been removed from CropManager.` });
  res.json({ deleted: true });
});

/* -------------------------------------------------------------- bulk import */
// POST /api/admin/organizations/:orgId/import-farmers  { csv, consent_confirmed }
// One email per line (an "email" header is optional). Farmers must already have an account.
export const importFarmers = asyncHandler(async (req, res) => {
  const org = req.org;
  if (req.body?.consent_confirmed !== true) throw createHttpError(400, 'Confirm that the farmers have agreed to share a summary of their farm activity', { code: 'consent_required' });
  if (org.status !== 'active') throw createHttpError(400, 'The organization must be active');
  const emails = [...new Set(String(req.body?.csv || '').split(/\r?\n/).map((l) => l.split(',')[0].replace(/^"|"$/g, '').trim().toLowerCase()).filter((e) => e && e !== 'email'))];
  if (!emails.length) throw createHttpError(400, 'No email addresses found');
  if (emails.length > 2000) throw createHttpError(400, 'Import at most 2000 farmers at a time');

  const result = { joined: 0, rows: [] };
  let stop = false;
  for (const email of emails) {
    if (stop) { result.rows.push({ email, result: 'limit_reached' }); continue; }
    if (!isEmail(email)) { result.rows.push({ email, result: 'invalid_email' }); continue; }
    const profile = await Profile.findOne({ email: new RegExp(`^${esc(email)}$`, 'i') }).lean();
    if (!profile) { result.rows.push({ email, result: 'not_registered' }); continue; }
    if (profile.is_admin || profile.user_type === 'org') { result.rows.push({ email, result: 'not_a_farmer' }); continue; }
    try {
      await attachFarmer({ farmerId: profile.user_id, org, consentSource: 'bulk_import' });
      if (profile.account_status !== 'active') {
        await Profile.updateOne({ user_id: profile.user_id, account_status: { $in: ['new', 'pending'] } }, { $set: { ...statusPatch('active', 'system:import'), approved_at: new Date() } });
      }
      result.joined += 1;
      result.rows.push({ email, result: 'joined' });
    } catch (err) {
      const code = err?.details?.code || 'error';
      if (code === 'org_limit') stop = true;
      result.rows.push({ email, result: code });
    }
  }
  await audit(req, 'farmers.imported', { target_type: 'organization', target_id: org._id, organization_id: org._id, details: { requested: emails.length, joined: result.joined, consent: 'confirmed by administrator' } });
  res.json(result);
});

/* ---------------------------------------------------- settings, audit, stats */
export const getOrgSettingsAdmin = asyncHandler(async (_req, res) => res.json(await getOrgSettings()));

export const putOrgSettingsAdmin = asyncHandler(async (req, res) => {
  const before = await getOrgSettings();
  const next = await setOrgSettings(req.body || {}, req.userId);
  await audit(req, 'settings.updated', { target_type: 'org_settings', details: { before, after: next } });
  res.json(next);
});

export const listAuditLogs = asyncHandler(async (req, res) => {
  const { action, organization_id: orgId, q, from, to } = req.query;
  const filter = {};
  if (action) filter.action = String(action).slice(0, 60);
  if (orgId && /^[a-f0-9]{24}$/i.test(orgId)) filter.organization_id = orgId;
  if (from || to) {
    filter.created_at = {};
    if (/^\d{4}-\d{2}-\d{2}$/.test(from || '')) filter.created_at.$gte = new Date(`${from}T00:00:00Z`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(to || '')) filter.created_at.$lte = new Date(`${to}T23:59:59Z`);
  }
  if (q) {
    const rx = new RegExp(esc(String(q).slice(0, 80)), 'i');
    filter.$or = [{ actor_name: rx }, { action: rx }, { target_id: rx }];
  }
  const perPage = Math.min(100, Math.max(1, Number(req.query.perPage) || 25));
  const page = Math.max(1, Number(req.query.page) || 1);
  const [rows, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip((page - 1) * perPage).limit(perPage).lean(),
    AuditLog.countDocuments(filter),
  ]);
  const orgs = await Organization.find({ _id: { $in: rows.map((r) => r.organization_id).filter(Boolean) } }, 'name').lean();
  const name = Object.fromEntries(orgs.map((o) => [String(o._id), o.name]));
  res.json({
    data: rows.map((r) => ({
      id: String(r._id), action: r.action, actor: r.actor_name || r.actor_id, target_type: r.target_type, target_id: r.target_id,
      organization: r.organization_id ? name[String(r.organization_id)] || String(r.organization_id) : '', details: r.details, ip: r.ip, created_at: r.created_at,
    })),
    total, page, perPage,
  });
});

export const platformStats = asyncHandler(async (_req, res) => {
  const [orgCounts, links, farmerProfiles, farms] = await Promise.all([
    Organization.aggregate([{ $group: { _id: '$status', n: { $sum: 1 }, farmers: { $sum: '$farmer_count' } } }]),
    FarmerOrganization.find({ status: 'active' }, 'farmer_id').lean(),
    Profile.countDocuments({ is_admin: { $ne: true }, user_type: { $ne: 'org' }, account_status: 'active' }),
    Farm.find({}, 'user_id total_area area_unit').lean(),
  ]);
  const inOrg = new Set(links.map((l) => l.farmer_id));
  let orgHa = 0;
  let otherHa = 0;
  for (const f of farms) {
    const ha = (f.total_area || 0) * (AREA[f.area_unit] ?? 1);
    if (inOrg.has(f.user_id)) orgHa += ha; else otherHa += ha;
  }
  res.json({
    organizations: Object.fromEntries(orgCounts.map((c) => [c._id, c.n])),
    farmers_in_organizations: inOrg.size,
    independent_farmers: Math.max(0, farmerProfiles - inOrg.size),
    farms: farms.length,
    hectares: { organizations: orgHa, independent: otherHa },
  });
});

// the farmer limit and joining are covered by joinError codes; exported so tests can import them
export { joinError };
