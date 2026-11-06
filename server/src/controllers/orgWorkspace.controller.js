import createHttpError from '../lib/httpError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import * as M from '../models/index.js';
import { audit } from '../lib/orgs/core.js';
import { RESEND_AFTER_MS, INVITE_DAYS, inviteFarmerEmails, inviteView, parseEmails } from '../lib/orgs/farmerInvites.js';
import { sendInvitationEmail } from '../lib/orgs/invite.js';

/*
 * The organization's own workspace: inviting farmers, seeing and managing pending invitations, looking at one farmer's crop records,
 * changing team roles and reading the organization's activity log. Every route is already limited to this organization's members
 * (orgAccess); the ones that change the team or read the log are limited to administrators.
 */

/* ---------------------------------------------------------------- invitations */
// POST /orgs/:orgId/farmer-invites { emails | csv, consent_confirmed: true }
export const inviteFarmers = asyncHandler(async (req, res) => {
  const org = req.org;
  if (req.body?.consent_confirmed !== true) {
    throw createHttpError(400, 'Confirm that the farmers have agreed to share a summary of their farm activity', { code: 'consent_required' });
  }
  if (org.status !== 'active') throw createHttpError(400, 'The organization must be approved before it can invite farmers', { code: 'org_not_active' });
  const emails = parseEmails(req.body?.emails ?? req.body?.csv);
  if (!emails.length) throw createHttpError(400, 'Enter at least one email address');
  if (emails.length > 200) throw createHttpError(400, 'Invite at most 200 farmers at a time');
  const result = await inviteFarmerEmails({ org, emails, actorId: req.userId });
  await audit(req, 'farmers.invited', {
    target_type: 'organization', target_id: org._id, organization_id: org._id,
    details: { requested: emails.length, joined: result.joined, invited: result.invited, consent: 'confirmed by an organization member' },
  });
  res.json(result);
});

// GET /orgs/:orgId/farmer-invites?status=invited|joined|revoked|expired
export const listFarmerInvites = asyncHandler(async (req, res) => {
  const rows = await M.FarmerInvite.find({ organization_id: req.org._id }).sort({ created_at: -1 }).limit(500).lean();
  let data = rows.map(inviteView);
  const want = String(req.query.status || '');
  if (['invited', 'joined', 'revoked', 'expired'].includes(want)) data = data.filter((i) => i.status === want);
  const counts = { invited: 0, joined: 0, revoked: 0, expired: 0 };
  for (const r of rows) counts[inviteView(r).status] += 1;
  res.json({ data, counts });
});

// POST /orgs/:orgId/farmer-invites/:inviteId/resend
export const resendFarmerInvite = asyncHandler(async (req, res) => {
  const invite = await M.FarmerInvite.findOne({ _id: req.params.inviteId, organization_id: req.org._id });
  if (!invite) throw createHttpError(404, 'Invitation not found');
  if (invite.status === 'joined') throw createHttpError(400, 'This farmer has already joined', { code: 'already_joined' });
  if (req.org.status !== 'active') throw createHttpError(400, 'The organization must be active', { code: 'org_not_active' });
  const wait = invite.last_sent_at ? RESEND_AFTER_MS - (Date.now() - invite.last_sent_at.getTime()) : 0;
  if (wait > 0) throw createHttpError(429, `This invitation was sent a moment ago. Try again in ${Math.ceil(wait / 60_000)} minutes.`, { code: 'too_soon' });
  invite.status = 'invited';
  invite.expires_at = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  const mail = await sendInvitationEmail(invite.email, { publicMetadata: { organization: req.org.name } });
  invite.email_sent = mail.sent;
  invite.email_error = mail.error || '';
  if (mail.sent) { invite.sent_count += 1; invite.last_sent_at = new Date(); }
  await invite.save();
  await audit(req, 'farmer_invite.resent', { target_type: 'farmer_invite', target_id: invite._id, organization_id: req.org._id, details: { email: invite.email, sent: mail.sent } });
  res.json(inviteView(invite));
});

// DELETE /orgs/:orgId/farmer-invites/:inviteId
export const revokeFarmerInvite = asyncHandler(async (req, res) => {
  const invite = await M.FarmerInvite.findOneAndUpdate(
    { _id: req.params.inviteId, organization_id: req.org._id, status: 'invited' },
    { $set: { status: 'revoked' } },
    { new: true }
  );
  if (!invite) throw createHttpError(404, 'Invitation not found or no longer waiting');
  await audit(req, 'farmer_invite.revoked', { target_type: 'farmer_invite', target_id: invite._id, organization_id: req.org._id, details: { email: invite.email } });
  res.json(inviteView(invite));
});

/* ------------------------------------------------------------- one farmer's records */
const AREA = { hectares: 1, acres: 0.404686, 'square metres': 0.0001 };
const KG = { kg: 1, tonnes: 1000 };
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const OPEN = ['Planned', 'Planted', 'Growing', 'Ready for Harvest'];

// GET /orgs/:orgId/farmers/:farmerId/records: crop production only (the same scope as the dashboard: no money, stock or equipment)
export const getFarmerRecords = asyncHandler(async (req, res) => {
  const farmerId = String(req.params.farmerId);
  const link = await M.FarmerOrganization.findOne({ organization_id: req.org._id, farmer_id: farmerId, status: 'active' }).lean();
  if (!link) throw createHttpError(404, 'Farmer not found in this organization');
  const [profile, farms, fields, cycles, crops, activities, scouting, protection, harvests] = await Promise.all([
    M.Profile.findOne({ user_id: farmerId }, 'full_name email phone location').lean(),
    M.Farm.find({ user_id: farmerId }, 'name district province total_area area_unit').lean(),
    M.Field.find({ user_id: farmerId }, 'name area area_unit farm_id').lean(),
    M.CropCycle.find({ user_id: farmerId }, 'crop_id status planting_date expected_harvest_date area_planted area_unit').sort({ planting_date: -1 }).limit(100).lean(),
    M.Crop.find({ user_id: farmerId }, 'name').lean(),
    M.FieldActivity.find({ user_id: farmerId }, 'activity_type activity_date description').sort({ activity_date: -1 }).limit(10).lean(),
    M.CropScoutingRecord.find({ user_id: farmerId }, 'scouting_date plant_health pest_observation disease_observation recommendation').sort({ scouting_date: -1 }).limit(8).lean(),
    M.CropProtectionRecord.find({ user_id: farmerId }, 'protection_date problem_type problem_name severity').sort({ protection_date: -1 }).limit(8).lean(),
    M.HarvestRecord.find({ user_id: farmerId }, 'crop_id quantity unit harvest_date').sort({ harvest_date: -1 }).limit(200).lean(),
  ]);
  const cropName = Object.fromEntries(crops.map((c) => [String(c._id), c.name]));
  const harvested = {};
  for (const h of harvests) {
    const name = cropName[String(h.crop_id)] || '—';
    harvested[name] = (harvested[name] || 0) + num(h.quantity) * (KG[h.unit] || 0);
  }
  await audit(req, 'farmer.records_viewed', { target_type: 'farmer', target_id: farmerId, organization_id: req.org._id });
  res.json({
    farmer: { id: farmerId, name: profile?.full_name || profile?.email || '—', email: profile?.email || '', phone: profile?.phone || '', location: profile?.location || '', joined_at: link.joined_at },
    farms: farms.map((f) => ({ id: String(f._id), name: f.name, district: f.district || '', hectares: Math.round(num(f.total_area) * (AREA[f.area_unit] ?? 1) * 100) / 100 })),
    fields: fields.length,
    cycles: cycles.filter((c) => OPEN.includes(c.status)).map((c) => ({
      id: String(c._id), crop: cropName[String(c.crop_id)] || '—', status: c.status, planting_date: c.planting_date, expected_harvest_date: c.expected_harvest_date,
      hectares: Math.round(num(c.area_planted) * (AREA[c.area_unit] ?? 1) * 100) / 100,
    })),
    activities: activities.map((a) => ({ type: a.activity_type, date: a.activity_date, description: a.description || '' })),
    scouting: scouting.map((s) => ({ date: s.scouting_date, health: s.plant_health, pest: s.pest_observation || '', disease: s.disease_observation || '', recommendation: s.recommendation || '' })),
    protection: protection.map((p) => ({ date: p.protection_date, type: p.problem_type, name: p.problem_name, severity: p.severity || '' })),
    harvested_kg: Object.entries(harvested).map(([crop, kg]) => ({ crop, kg: Math.round(kg) })).sort((a, b) => b.kg - a.kg),
  });
});

/* -------------------------------------------------------------- team and activity */
// PATCH /orgs/:orgId/members/:memberId { role }
export const updateMemberRole = asyncHandler(async (req, res) => {
  const role = req.body?.role;
  if (!['org_admin', 'org_staff'].includes(role)) throw createHttpError(400, 'Choose administrator or staff');
  const m = await M.OrganizationMember.findOne({ _id: req.params.memberId, organization_id: req.org._id, status: { $in: ['active', 'invited'] } });
  if (!m) throw createHttpError(404, 'Team member not found');
  if (m.role === 'org_admin' && role !== 'org_admin' && m.status === 'active') {
    const admins = await M.OrganizationMember.countDocuments({ organization_id: req.org._id, role: 'org_admin', status: 'active' });
    if (admins <= 1) throw createHttpError(400, 'The organization needs at least one administrator.');
  }
  const before = m.role;
  m.role = role;
  await m.save();
  await audit(req, 'member.role_changed', { target_type: 'member', target_id: m._id, organization_id: req.org._id, details: { before, after: role } });
  res.json({ id: String(m._id), role: m.role, status: m.status });
});

// GET /orgs/:orgId/activity?page=
export const listOrgActivity = asyncHandler(async (req, res) => {
  const perPage = Math.min(100, Math.max(1, Number(req.query.perPage) || 25));
  const page = Math.max(1, Number(req.query.page) || 1);
  const filter = { organization_id: req.org._id };
  const [rows, total] = await Promise.all([
    M.AuditLog.find(filter).sort({ created_at: -1 }).skip((page - 1) * perPage).limit(perPage).lean(),
    M.AuditLog.countDocuments(filter),
  ]);
  res.json({
    data: rows.map((r) => ({ id: String(r._id), action: r.action, actor: r.actor_name || '', target_type: r.target_type, details: r.details || {}, created_at: r.created_at })),
    total, page, perPage,
  });
});
