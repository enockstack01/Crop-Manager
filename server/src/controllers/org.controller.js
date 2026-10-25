import createHttpError from '../lib/httpError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { env } from '../config/env.js';
import { notifyAdmins, statusPatch } from '../lib/accountStatus.js';
import {
  FarmerOrganization, Organization, OrganizationMember, Profile, ReferralLink,
} from '../models/index.js';
import {
  queueReferredFarmer, attachFarmer, audit, checkLink, detachFarmer, getOrgSettings, hashToken, joinError, newToken,
  notifyUsers, orgAdminIds, orgContextFor, orgView,
} from '../lib/orgs/core.js';
import { buildDashboard, listFarmers } from '../lib/orgs/dashboard.js';

const str = (v, max = 200) => (v === undefined || v === null ? '' : String(v).trim().slice(0, max));
const ORG_FIELDS = ['type', 'country', 'district', 'sector', 'contact_email', 'contact_phone'];
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const publicUrl = () => process.env.PUBLIC_APP_URL || (env.isProd ? 'https://crop.agricoders.com' : env.clientOrigin);

/* ------------------------------------------------------- organization sign-up */
// POST /api/organizations/register: the person signs up (Clerk) first, then registers their organization
export const registerOrganization = asyncHandler(async (req, res) => {
  const me = req.profile;
  if (me.is_admin) throw createHttpError(400, 'Administrator accounts cannot register an organization.');
  if (me.user_type === 'org' && (await OrganizationMember.exists({ user_id: me.user_id, status: { $in: ['active', 'invited'] } }))) {
    throw createHttpError(409, 'Your account already belongs to an organization.', { code: 'already_in_org' });
  }
  if (me.user_type !== 'org' && me.account_status !== 'new') {
    throw createHttpError(400, 'This account is already used as a farmer account. Register the organization with a new account.', { code: 'account_in_use' });
  }
  if (await FarmerOrganization.exists({ farmer_id: me.user_id, status: 'active' })) {
    throw createHttpError(400, 'This account is linked to an organization as a farmer.', { code: 'account_in_use' });
  }

  const b = req.body || {};
  const name = str(b.name, 160);
  if (!name) throw createHttpError(400, 'Enter the organization name', { code: 'name_required' });
  const contactEmail = str(b.contact_email, 160) || me.email || '';
  if (contactEmail && !isEmail(contactEmail)) throw createHttpError(400, 'Enter a valid contact email');
  if (await Organization.exists({ name_key: name.toLowerCase() })) throw createHttpError(409, 'An organization with this name already exists.', { code: 'name_taken' });

  const settings = await getOrgSettings();
  const org = await Organization.create({
    name, name_key: name.toLowerCase(),
    type: ['Cooperative', 'NGO', 'Company', 'Government', 'Other'].includes(b.type) ? b.type : 'Other',
    country: str(b.country, 100), district: str(b.district, 100), sector: str(b.sector, 100),
    contact_email: contactEmail, contact_phone: str(b.contact_phone, 40),
    status: 'pending', max_farmers: settings.default_max_farmers, created_by: me.user_id,
  });
  await OrganizationMember.create({ organization_id: org._id, user_id: me.user_id, role: 'org_admin', status: 'active' });
  await Profile.updateOne(
    { user_id: me.user_id },
    { $set: { user_type: 'org', full_name: str(b.full_name, 120) || me.full_name, phone: str(b.phone, 40), ...statusPatch('active', 'system:org-register'), onboarded: true } }
  );
  await audit(req, 'organization.registered', { target_type: 'organization', target_id: org._id, organization_id: org._id, details: { name } });
  await notifyAdmins({ type: 'info', title: 'New organization', message: `${name} (${org.type}) is waiting for approval.` });
  res.status(201).json(orgView(org));
});

/* --------------------------------------------------------------- organization */
export const getOrganization = asyncHandler(async (req, res) => {
  res.json({ ...orgView(req.org), role: req.membership?.role || 'system_admin' });
});

export const updateOrganization = asyncHandler(async (req, res) => {
  const org = req.org;
  const b = req.body || {};
  const before = orgView(org);
  if (b.name !== undefined) {
    const name = str(b.name, 160);
    if (!name) throw createHttpError(400, 'Enter the organization name');
    if (name.toLowerCase() !== org.name_key && (await Organization.exists({ name_key: name.toLowerCase(), _id: { $ne: org._id } }))) {
      throw createHttpError(409, 'An organization with this name already exists.', { code: 'name_taken' });
    }
    org.name = name;
    org.name_key = name.toLowerCase();
  }
  for (const f of ORG_FIELDS) if (b[f] !== undefined) org[f] = str(b[f], 160);
  if (b.contact_email && !isEmail(org.contact_email)) throw createHttpError(400, 'Enter a valid contact email');
  await org.save();
  await audit(req, 'organization.updated', { target_type: 'organization', target_id: org._id, organization_id: org._id, details: { before, after: orgView(org) } });
  res.json(orgView(org));
});

/* ---------------------------------------------------------------------- team */
export const listMembers = asyncHandler(async (req, res) => {
  const rows = await OrganizationMember.find({ organization_id: req.org._id, status: { $in: ['active', 'invited'] } }).sort({ created_at: 1 }).lean();
  const profiles = await Profile.find({ user_id: { $in: rows.map((r) => r.user_id).filter(Boolean) } }, 'user_id full_name email').lean();
  const by = Object.fromEntries(profiles.map((p) => [p.user_id, p]));
  res.json(rows.map((r) => ({
    id: String(r._id), role: r.role, status: r.status,
    name: by[r.user_id]?.full_name || '', email: by[r.user_id]?.email || r.invited_email || '', created_at: r.created_at,
  })));
});

export const inviteMember = asyncHandler(async (req, res) => {
  const email = str(req.body?.email, 160).toLowerCase();
  const role = req.body?.role === 'org_admin' ? 'org_admin' : 'org_staff';
  if (!isEmail(email)) throw createHttpError(400, 'Enter a valid email address');
  const existingProfile = await Profile.findOne({ email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).lean();
  if (existingProfile && existingProfile.user_type !== 'org' && existingProfile.account_status !== 'new') {
    throw createHttpError(400, 'This email belongs to a farmer account. Invite a different email address.', { code: 'email_is_farmer' });
  }
  if (existingProfile && (await OrganizationMember.exists({ user_id: existingProfile.user_id, status: 'active', organization_id: { $ne: req.org._id } }))) {
    throw createHttpError(409, 'This person already works for another organization.', { code: 'in_other_org' });
  }
  const dup = await OrganizationMember.findOne({ organization_id: req.org._id, status: { $in: ['active', 'invited'] }, $or: [{ invited_email: email }, ...(existingProfile ? [{ user_id: existingProfile.user_id }] : [])] });
  if (dup) throw createHttpError(409, 'This person is already on the team.');
  const m = await OrganizationMember.create({ organization_id: req.org._id, invited_email: email, role, status: 'invited', user_id: null });
  await audit(req, 'member.invited', { target_type: 'member', target_id: m._id, organization_id: req.org._id, details: { email, role } });
  res.status(201).json({ id: String(m._id), email, role, status: 'invited' });
});

export const removeMember = asyncHandler(async (req, res) => {
  const m = await OrganizationMember.findOne({ _id: req.params.memberId, organization_id: req.org._id, status: { $in: ['active', 'invited'] } });
  if (!m) throw createHttpError(404, 'Team member not found');
  if (m.role === 'org_admin' && m.status === 'active') {
    const admins = await OrganizationMember.countDocuments({ organization_id: req.org._id, role: 'org_admin', status: 'active' });
    if (admins <= 1) throw createHttpError(400, 'The organization needs at least one administrator.');
  }
  m.status = 'removed';
  await m.save();
  await audit(req, 'member.removed', { target_type: 'member', target_id: m._id, organization_id: req.org._id, details: { user_id: m.user_id, email: m.invited_email } });
  res.json({ id: String(m._id), removed: true });
});

/* ------------------------------------------------------------ referral links */
export const createLink = asyncHandler(async (req, res) => {
  const org = req.org;
  if (org.status !== 'active') {
    throw createHttpError(403, org.status === 'pending' ? 'Referral links can be created once the organization is approved.' : 'This organization is suspended.', { code: org.status === 'pending' ? 'org_pending' : 'org_suspended' });
  }
  const settings = await getOrgSettings();
  let maxUses = req.body?.max_uses === '' || req.body?.max_uses == null ? settings.default_max_uses : Number(req.body.max_uses);
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100000) throw createHttpError(400, 'Maximum uses must be a whole number of 1 or more');
  const token = newToken();
  const link = await ReferralLink.create({
    organization_id: org._id,
    token_hash: hashToken(token),
    label: str(req.body?.label, 80),
    created_by: req.userId,
    expires_at: new Date(Date.now() + settings.referral_hours * 3_600_000),
    max_uses: maxUses,
  });
  await audit(req, 'referral_link.created', { target_type: 'referral_link', target_id: link._id, organization_id: org._id, details: { expires_at: link.expires_at, max_uses: maxUses, label: link.label } });
  // the full link is returned this once; only its hash is stored
  res.status(201).json({ id: String(link._id), url: `${publicUrl()}/join/${token}`, expires_at: link.expires_at, max_uses: link.max_uses, label: link.label, status: 'active', use_count: 0 });
});

const linkStatus = (l, org) =>
  l.revoked_at ? 'revoked' : l.expires_at <= new Date() ? 'expired' : l.max_uses != null && l.use_count >= l.max_uses ? 'full' : org.status !== 'active' ? 'inactive' : 'active';

export const listLinks = asyncHandler(async (req, res) => {
  const rows = await ReferralLink.find({ organization_id: req.org._id }).sort({ created_at: -1 }).limit(100).lean();
  const creators = await Profile.find({ user_id: { $in: [...new Set(rows.map((r) => r.created_by))] } }, 'user_id full_name email').lean();
  const by = Object.fromEntries(creators.map((p) => [p.user_id, p.full_name || p.email]));
  res.json(rows.map((l) => ({
    id: String(l._id), label: l.label, status: linkStatus(l, req.org), created_by: by[l.created_by] || '',
    created_at: l.created_at, expires_at: l.expires_at, max_uses: l.max_uses, use_count: l.use_count,
  })));
});

export const revokeLink = asyncHandler(async (req, res) => {
  const link = await ReferralLink.findOneAndUpdate({ _id: req.params.linkId, organization_id: req.org._id, revoked_at: null }, { $set: { revoked_at: new Date() } }, { new: true });
  if (!link) throw createHttpError(404, 'Link not found or already revoked');
  await audit(req, 'referral_link.revoked', { target_type: 'referral_link', target_id: link._id, organization_id: req.org._id });
  res.json({ id: String(link._id), status: 'revoked' });
});

/* ----------------------------------------------------------------- farmers */
const filtersOf = (q) => ({
  q: str(q.q, 80), district: str(q.district, 100), crop: str(q.crop, 80), inactive: q.inactive === '1' ? '1' : '',
  joined_from: /^\d{4}-\d{2}-\d{2}$/.test(q.joined_from || '') ? q.joined_from : '', sort: str(q.sort, 20), order: q.order === 'desc' ? 'desc' : 'asc',
});

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const getFarmers = asyncHandler(async (req, res) => {
  const settings = await getOrgSettings();
  const rows = await listFarmers(req.org, filtersOf(req.query), settings);
  if (req.query.format === 'csv') {
    const head = ['Name', 'Location', 'Farms', 'Farm size (ha)', 'Main crops', 'Joined', 'Last activity'];
    const lines = [head, ...rows.map((r) => [r.name, r.location, r.farms, Math.round(r.farm_ha * 10) / 10, r.crops.join('; '), r.joined_at ? new Date(r.joined_at).toISOString().slice(0, 10) : '', r.last_activity ? new Date(r.last_activity).toISOString().slice(0, 10) : ''])];
    await audit(req, 'farmers.exported', { target_type: 'organization', target_id: req.org._id, organization_id: req.org._id, details: { rows: rows.length } });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="farmers-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(`﻿${lines.map((l) => l.map(csvCell).join(',')).join('\r\n')}`);
  }
  const perPage = Math.min(100, Math.max(1, Number(req.query.perPage) || 25));
  const page = Math.max(1, Number(req.query.page) || 1);
  res.json({ data: rows.slice((page - 1) * perPage, page * perPage), total: rows.length, page, perPage });
});

export const removeFarmer = asyncHandler(async (req, res) => {
  const row = await detachFarmer({ farmerId: req.params.farmerId, orgId: req.org._id, status: 'removed', by: req.userId, reason: str(req.body?.reason, 300) });
  if (!row) throw createHttpError(404, 'Farmer not found in this organization');
  await audit(req, 'farmer.removed', { target_type: 'farmer', target_id: row.farmer_id, organization_id: req.org._id, details: { reason: row.end_reason } });
  await notifyUsers([row.farmer_id], { type: 'info', title: 'Removed from organization', message: `You are no longer linked to ${req.org.name}. Your farm data is unchanged.` });
  res.json({ removed: true });
});

export const getDashboard = asyncHandler(async (req, res) => {
  const settings = await getOrgSettings();
  const q = req.query;
  const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
  res.json(await buildDashboard(req.org, { from: date(q.from), to: date(q.to), district: str(q.district, 100) }, settings, { fresh: q.fresh === '1' }));
});

/* ------------------------------------------------------------ farmer side */
// GET /api/join/:token (public): shows the organization before the farmer signs up or in
export const joinInfo = asyncHandler(async (req, res) => {
  const { link, org } = await checkLink(req.params.token);
  res.json({ valid: true, organization: { name: org.name, type: org.type, district: org.district, country: org.country }, expires_at: link.expires_at });
});

// POST /api/join/:token: signed-in farmer agrees to share a summary and joins. Everything is checked again here.
export const joinOrganization = asyncHandler(async (req, res) => {
  const me = req.profile;
  if (me.is_admin) throw joinError('admin_account');
  if (me.user_type === 'org') throw joinError('org_account');
  if (['on_hold', 'deactivated', 'rejected'].includes(me.account_status)) throw joinError('account_blocked');
  if (req.body?.consent !== true) throw joinError('consent_required');

  const { link, org } = await checkLink(req.params.token);
  await attachFarmer({ farmerId: me.user_id, org, link });
  await queueReferredFarmer(me, org);
  await audit(req, 'farmer.joined', { target_type: 'farmer', target_id: me.user_id, organization_id: org._id, details: { referral_link_id: String(link._id) } });
  await notifyUsers([me.user_id], { type: 'success', title: 'You joined an organization', message: `You are now linked to ${org.name}. They can see a summary of your crop activity.` });
  res.json({ joined: true, organization: { id: String(org._id), name: org.name } });
});

export const myOrganization = asyncHandler(async (req, res) => {
  res.json(await orgContextFor(req.profile));
});

export const leaveOrganization = asyncHandler(async (req, res) => {
  const row = await detachFarmer({ farmerId: req.userId, status: 'left', by: req.userId, reason: 'left by the farmer' });
  if (!row) throw createHttpError(404, 'You are not linked to an organization');
  const org = await Organization.findById(row.organization_id).lean();
  await audit(req, 'farmer.left', { target_type: 'farmer', target_id: req.userId, organization_id: row.organization_id });
  await notifyUsers(await orgAdminIds(row.organization_id), { type: 'info', title: 'A farmer left', message: `A farmer left ${org?.name || 'your organization'}.` });
  res.json({ left: true });
});
