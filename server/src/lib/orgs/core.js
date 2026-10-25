import crypto from 'node:crypto';
import createHttpError from '../httpError.js';
import { AuditLog, FarmerOrganization, Notification, Organization, OrganizationMember, Profile, ReferralLink, SystemSetting } from '../../models/index.js';
import { notifyAdmins, statusPatch } from '../accountStatus.js';

/* ------------------------------------------------------------------ settings */
const KEY = 'org_settings';
export const ORG_DEFAULTS = {
  referral_hours: 6, // how long a referral link stays valid
  default_max_farmers: 100, // farmer limit given to a new organization
  default_max_uses: 100, // registrations one link accepts unless the organization sets another cap
  inactive_days: 30, // a farmer with no recorded activity for this long counts as inactive
};

export async function getOrgSettings() {
  const row = await SystemSetting.findOne({ key: KEY }).lean().catch(() => null);
  return { ...ORG_DEFAULTS, ...(row?.value || {}) };
}

export async function setOrgSettings(patch, by) {
  const next = { ...(await getOrgSettings()) };
  for (const k of Object.keys(ORG_DEFAULTS)) {
    if (patch[k] === undefined) continue;
    const v = Number(patch[k]);
    const max = k === 'referral_hours' ? 168 : 100000;
    if (!Number.isInteger(v) || v < (k === 'default_max_farmers' ? 0 : 1) || v > max) throw createHttpError(400, `${k} must be a whole number up to ${max}`);
    next[k] = v;
  }
  await SystemSetting.findOneAndUpdate({ key: KEY }, { $set: { value: next, updated_by: by || null } }, { upsert: true });
  return next;
}

/* --------------------------------------------------------------------- audit */
/** Records who did what to what. Never throws: an audit failure must not break the action itself. */
export async function audit(req, action, { target_type = '', target_id = '', organization_id = null, details = {} } = {}) {
  try {
    await AuditLog.create({
      actor_id: req?.userId || null,
      actor_name: req?.profile?.full_name || req?.profile?.email || '',
      action,
      target_type,
      target_id: String(target_id || ''),
      organization_id: organization_id || null,
      details,
      ip: req?.ip || '',
      user_agent: String(req?.headers?.['user-agent'] || '').slice(0, 200),
    });
  } catch (err) {
    console.error('[audit] failed', err.message);
  }
}

/* ------------------------------------------------------------- notifications */
export async function notifyUsers(userIds, { type = 'info', title, message }) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length) await Notification.insertMany(ids.map((user_id) => ({ user_id, type, title, message })));
}

export async function orgAdminIds(orgId) {
  const rows = await OrganizationMember.find({ organization_id: orgId, status: 'active', role: 'org_admin' }, 'user_id').lean();
  return rows.map((r) => r.user_id);
}

/* ------------------------------------------------------------------- tokens */
export const newToken = () => crypto.randomBytes(32).toString('base64url');
export const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

/** Codes the apps translate (Kinyarwanda, English, French). Messages here are the English fallback. */
const MESSAGES = {
  invalid: [404, 'This invitation link is no longer valid. Please contact your organization.'],
  revoked: [410, 'This invitation link is no longer valid. Please contact your organization.'],
  expired: [410, 'This invitation link has expired. Please ask your organization for a new link.'],
  link_full: [410, 'This invitation link has reached its limit. Please ask your organization for a new link.'],
  org_limit: [409, 'This organization cannot accept more farmers at the moment. Please contact your organization.'],
  org_suspended: [403, 'This organization is not accepting new farmers at the moment.'],
  already_member: [409, 'You are already a member of this organization.'],
  other_org: [409, 'You are currently linked to another organization. Leave it first or contact support.'],
  consent_required: [400, 'You must agree to share a summary of your farm activity to join.'],
  org_account: [403, 'This account belongs to an organization, so it cannot join as a farmer.'],
  admin_account: [403, 'Administrator accounts cannot join an organization as a farmer.'],
  account_blocked: [403, 'Your account is not active. Please contact support.'],
};
export const joinError = (code) => {
  const [status, message] = MESSAGES[code] || [400, 'Could not join this organization.'];
  return createHttpError(status, message, { code });
};

/** Validates a link with SERVER time only; the phone's clock is never used. */
export async function checkLink(token) {
  const link = await ReferralLink.findOne({ token_hash: hashToken(token) });
  if (!link) throw joinError('invalid');
  if (link.revoked_at) throw joinError('revoked');
  if (link.expires_at.getTime() <= Date.now()) throw joinError('expired');
  const org = await Organization.findById(link.organization_id);
  if (!org) throw joinError('invalid');
  if (org.status !== 'active') throw joinError('org_suspended');
  if (link.max_uses != null && link.use_count >= link.max_uses) throw joinError('link_full');
  if (org.farmer_count >= org.max_farmers) throw joinError('org_limit');
  return { link, org };
}

/* ---------------------------------------------------- joining and leaving */
/** Sends the 80 percent and 100 percent notices once each, and forgets them when the count drops again. */
async function syncLimitNotices(orgId) {
  const org = await Organization.findById(orgId).lean();
  if (!org) return;
  const ids = await orgAdminIds(orgId);
  const at80 = org.max_farmers > 0 && org.farmer_count >= org.max_farmers * 0.8;
  const at100 = org.farmer_count >= org.max_farmers;
  if (at80 && !org.notified_80 && (await Organization.findOneAndUpdate({ _id: orgId, notified_80: false }, { notified_80: true }))) {
    await notifyUsers(ids, { type: 'warning', title: 'Farmer limit at 80%', message: `${org.farmer_count} of ${org.max_farmers} farmers are linked to ${org.name}.` });
  }
  if (at100 && !org.notified_100 && (await Organization.findOneAndUpdate({ _id: orgId, notified_100: false }, { notified_100: true }))) {
    await notifyUsers(ids, { type: 'danger', title: 'Farmer limit reached', message: `${org.name} has reached its limit of ${org.max_farmers} farmers. New farmers cannot join until the limit is raised.` });
  }
  const reset = {};
  if (!at80 && org.notified_80) reset.notified_80 = false;
  if (!at100 && org.notified_100) reset.notified_100 = false;
  if (Object.keys(reset).length) await Organization.updateOne({ _id: orgId }, { $set: reset });
}

/**
 * Attaches a farmer to an organization. The farmer limit and the link's use cap are taken with atomic
 * conditional updates, so many farmers joining at the same moment can never exceed either one; if a later
 * step fails, the counters are put back.
 */
export async function attachFarmer({ farmerId, org, link = null, consentSource = 'farmer' }) {
  const existing = await FarmerOrganization.findOne({ farmer_id: farmerId, status: 'active' }).lean();
  if (existing) throw joinError(String(existing.organization_id) === String(org._id) ? 'already_member' : 'other_org');

  let usedLink = false;
  let reserved = false;
  try {
    if (link) {
      const hit = await ReferralLink.findOneAndUpdate(
        {
          _id: link._id,
          revoked_at: null,
          expires_at: { $gt: new Date() }, // checked again at the moment of joining
          $or: [{ max_uses: null }, { $expr: { $lt: ['$use_count', '$max_uses'] } }],
        },
        { $inc: { use_count: 1 } }
      );
      if (!hit) {
        const fresh = await ReferralLink.findById(link._id).lean();
        throw joinError(!fresh || fresh.revoked_at ? 'revoked' : fresh.expires_at <= new Date() ? 'expired' : 'link_full');
      }
      usedLink = true;
    }
    const slot = await Organization.findOneAndUpdate(
      { _id: org._id, status: 'active', $expr: { $lt: ['$farmer_count', '$max_farmers'] } },
      { $inc: { farmer_count: 1 } }
    );
    if (!slot) {
      const fresh = await Organization.findById(org._id).lean();
      throw joinError(fresh?.status === 'active' ? 'org_limit' : 'org_suspended');
    }
    reserved = true;
    const row = await FarmerOrganization.create({
      farmer_id: farmerId,
      organization_id: org._id,
      referral_link_id: link?._id || null,
      consent_given_at: new Date(),
      consent_source: consentSource,
    });
    await syncLimitNotices(org._id);
    return row;
  } catch (err) {
    if (reserved) await Organization.updateOne({ _id: org._id }, { $inc: { farmer_count: -1 } });
    if (usedLink) await ReferralLink.updateOne({ _id: link._id }, { $inc: { use_count: -1 } });
    if (err?.code === 11000) throw joinError('other_org'); // the unique index caught a simultaneous second join
    throw err;
  }
}

/** Ends a farmer's active link (they left, or an administrator removed them). Returns the ended row or null. */
export async function detachFarmer({ farmerId, orgId = null, status, by, reason = '' }) {
  const filter = { farmer_id: farmerId, status: 'active' };
  if (orgId) filter.organization_id = orgId;
  const row = await FarmerOrganization.findOneAndUpdate(
    filter,
    { $set: { status, ended_at: new Date(), ended_by: by || null, end_reason: String(reason).slice(0, 300) } },
    { new: true }
  );
  if (!row) return null;
  await Organization.updateOne({ _id: row.organization_id, farmer_count: { $gt: 0 } }, { $inc: { farmer_count: -1 } });
  await syncLimitNotices(row.organization_id);
  return row;
}

/**
 * A farmer who arrives through an organization link is linked to the organization but is NOT let in: a
 * system administrator still approves every account. A brand-new account goes into the approval queue with
 * its request filled in from the organization, and the administrators are told.
 */
export async function queueReferredFarmer(profile, org) {
  if (profile.account_status !== 'new') return; // already approved, or already waiting
  const done = await Profile.updateOne(
    { user_id: profile.user_id, account_status: 'new' },
    {
      $set: {
        ...statusPatch('pending', 'system:referral'),
        onboarded: true,
        access_request: {
          account_type: 'Farmer',
          organization: org.name,
          country: org.country || '',
          message: `Joined through a referral link of ${org.name}.`,
          submitted_at: new Date(),
        },
      },
    }
  );
  if (done.modifiedCount) {
    await notifyAdmins({ type: 'info', title: 'New farmer account to approve', message: `${profile.full_name || profile.email || 'A farmer'} joined through ${org.name} and is waiting for approval.` });
  }
}

/* ------------------------------------------------------------ user context */
/** What the apps need to choose the right workspace: role, organization and (for farmers) their link. */
export async function orgContextFor(profile) {
  const out = {
    platform_role: profile.is_admin ? 'system_admin' : profile.user_type === 'org' ? 'org_user' : 'farmer',
    membership: null,
    farmer_org: null,
  };
  if (profile.user_type === 'org' || profile.email) {
    // staff invited by email join the moment they sign in
    if (profile.email) {
      const invites = await OrganizationMember.find({ user_id: null, invited_email: profile.email.toLowerCase(), status: 'invited' });
      for (const inv of invites) {
        const convertible = profile.user_type === 'org' || profile.account_status === 'new';
        if (!convertible) continue;
        inv.user_id = profile.user_id;
        inv.status = 'active';
        await inv.save();
        if (profile.user_type !== 'org') {
          await Profile.updateOne({ user_id: profile.user_id }, { $set: { user_type: 'org', ...statusPatch('active', 'system:invite') } });
          out.platform_role = profile.is_admin ? 'system_admin' : 'org_user';
        }
      }
    }
    const m = await OrganizationMember.findOne({ user_id: profile.user_id, status: 'active' }).lean();
    if (m) {
      const org = await Organization.findById(m.organization_id).lean();
      if (org) out.membership = { role: m.role, organization: orgView(org) };
    }
  }
  const fo = await FarmerOrganization.findOne({ farmer_id: profile.user_id, status: 'active' }).lean();
  if (fo) {
    const org = await Organization.findById(fo.organization_id, 'name type district status').lean();
    if (org) out.farmer_org = { organization: { id: String(org._id), name: org.name, type: org.type, district: org.district }, joined_at: fo.joined_at, consent_given_at: fo.consent_given_at };
  }
  return out;
}

export const orgView = (o) => ({
  id: String(o._id || o.id),
  name: o.name,
  type: o.type,
  country: o.country,
  district: o.district,
  sector: o.sector,
  contact_email: o.contact_email,
  contact_phone: o.contact_phone,
  status: o.status,
  max_farmers: o.max_farmers,
  farmer_count: o.farmer_count,
  approved_at: o.approved_at,
  suspended_reason: o.suspended_reason || '',
  created_at: o.created_at,
});
