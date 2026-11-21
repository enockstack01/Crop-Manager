import createHttpError from './httpError.js';
import { FarmMember, FruitCount, Notification, Profile } from '../models/index.js';
import { resourceByPath } from '../resources.js';
import { notifyAdmins, statusPatch } from './accountStatus.js';
import { sendInvitationEmail } from './orgs/invite.js';
import { OPERATIONAL } from './farmPolicy.js';

/*
 * The farm manager's team of data collectors.
 *
 *   invite      the farm manager enters a name, an email address and optionally a phone number. An email goes out (through the sign-in
 *               service) with a link to set a password.
 *   accept      at the first sign-in with that address (verified) the invitation becomes the person's account and links it to the manager's
 *               farm. The account then waits for a system administrator's approval, like every account on the platform.
 *   work        an approved collector works in the manager's farm (lib/farmPolicy.js says what they may do). What they record is tagged
 *               with their name.
 *   end         the manager can cancel an invitation that is waiting, or remove a collector at any time. Removing one ends their access;
 *               the entries they already made stay in the farm's records.
 */
export const INVITE_DAYS = 30;
export const RESEND_AFTER_MS = 10 * 60_000;
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const text = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const nameOf = (p) => p?.full_name || p?.email || '';

/** What the apps show about a member. `stats` is { week, last } from activityFor. */
export function memberView(m, stats = {}) {
  const expired = m.status === 'invited' && m.expires_at && m.expires_at <= new Date();
  const last = [m.last_activity_at, stats.last].filter(Boolean).map((d) => new Date(d).getTime());
  return {
    id: String(m._id), name: m.name || '', email: m.invited_email, phone: m.phone || '', role: m.role,
    status: expired ? 'expired' : m.status, invited_at: m.invited_at || m.created_at, expires_at: m.expires_at, accepted_at: m.accepted_at, last_sent_at: m.last_sent_at,
    email_sent: !!m.email_sent, email_error: m.email_error || '', member_id: m.member_id,
    week_entries: stats.week || 0, last_activity: last.length ? new Date(Math.max(...last)).toISOString() : null,
  };
}

/**
 * At sign-in: invitations written to the person's verified address are accepted.
 *  - a brand-new account that was invited as a data collector BECOMES a collector account, linked to that farm, and waits for approval;
 *  - any other account (an existing farmer invited to the greenhouse tab before this, or a second manager) is linked as before and keeps its own farm.
 * Never throws: a problem here must not stop anyone signing in.
 */
export async function acceptFarmInvites(profile) {
  try {
    const email = profile?.email_verified && profile?.email ? String(profile.email).toLowerCase() : null;
    if (!email || profile.is_admin || profile.user_type === 'org') return;
    const open = await FarmMember.find({ invited_email: email, status: 'invited', $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }] }).sort({ created_at: 1 });
    for (const inv of open) {
      const owner = await Profile.findOne({ user_id: inv.user_id }, 'full_name email').lean();
      if (inv.role === 'collector' && profile.account_status === 'new' && profile.user_type !== 'collector') {
        const patch = {
          user_type: 'collector', role: 'Data collector', onboarded: true,
          ...(profile.full_name ? {} : { full_name: inv.name }), ...(profile.phone ? {} : { phone: inv.phone }),
          ...statusPatch('pending', 'system:team'),
          access_request: { account_type: 'Data collector', organization: nameOf(owner), message: `Invited by ${nameOf(owner)} as a data collector.`, submitted_at: new Date() },
        };
        const done = await Profile.updateOne({ user_id: profile.user_id, account_status: 'new' }, { $set: patch });
        if (!done.modifiedCount) continue;
        Object.assign(profile, patch); // the caller reads the profile it already has
        await notifyAdmins({ type: 'info', title: 'New data collector to approve', message: `${profile.full_name || inv.name || email} accepted an invitation from ${nameOf(owner)} and is waiting for approval.` });
      } else if (profile.user_type === 'collector' && inv.role === 'collector') {
        if (await FarmMember.exists({ member_id: profile.user_id, status: 'active' })) continue; // one farm at a time
      }
      inv.member_id = profile.user_id;
      inv.status = 'active';
      inv.accepted_at = new Date();
      if (!inv.name) inv.name = profile.full_name || '';
      await inv.save();
      await Notification.create({ user_id: inv.user_id, type: 'success', title: 'Invitation accepted', message: `${inv.name || email} signed in and joined your team${inv.role === 'collector' ? '. Their account is waiting for approval.' : '.'}` }).catch(() => {});
      if (inv.role === 'collector') break; // a collector works for one farm
    }
  } catch (e) {
    console.warn('[team] could not accept invitations:', String(e?.message || e).slice(0, 120));
  }
}

/** The farm a collector works on, or null when they have none (never linked, or removed). */
export async function farmOf(memberId) {
  return FarmMember.findOne({ member_id: memberId, status: 'active', role: 'collector' });
}

/**
 * The farm manager adds a data collector. Returns the member as the apps show it. Throws a 400/409 with a plain message.
 * A person who has no account gets an emailed invitation; a data collector who already has an account (and no farm) is linked at once.
 */
export async function inviteCollector({ owner, name, email, phone }) {
  const fullName = text(name, 80);
  const address = text(email, 160).toLowerCase();
  const tel = text(phone, 30);
  if (fullName.length < 2) throw createHttpError(400, 'Enter the collector\'s name.');
  if (!isEmail(address)) throw createHttpError(400, 'Enter a valid email address.');
  if (tel && !/^[+0-9 ()\-.]{5,30}$/.test(tel)) throw createHttpError(400, 'The phone number may contain digits, spaces and + - ( ) only.');
  if (owner.email && owner.email.toLowerCase() === address) throw createHttpError(400, 'That is your own email address.');

  const have = await FarmMember.findOne({ user_id: owner.user_id, invited_email: address });
  if (have?.status === 'active') throw createHttpError(409, 'This person is already on your team.');
  if (have?.status === 'invited' && !(have.expires_at && have.expires_at <= new Date())) throw createHttpError(409, 'This person already has an invitation. You can send it again from the team list.');

  const person = await Profile.findOne({ email: new RegExp(`^${escapeRegex(address)}$`, 'i') }).lean();
  if (person) {
    if (person.is_admin || person.user_type === 'org') throw createHttpError(409, 'That email belongs to an administrator or an organization account, which cannot be a data collector.');
    if (person.user_type !== 'collector') throw createHttpError(409, 'That email already has its own CropManager account. A data collector needs a separate login: use another email address for them.');
    if (await FarmMember.exists({ member_id: person.user_id, status: 'active', user_id: { $ne: owner.user_id } })) throw createHttpError(409, 'That person is already a data collector for another farm.');
  }

  const doc = have || new FarmMember({ user_id: owner.user_id, invited_email: address, role: 'collector' });
  Object.assign(doc, { name: fullName, phone: tel, role: 'collector', status: 'invited', invited_at: new Date(), expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000), ended_at: null, ended_as: null, member_id: null, accepted_at: null });
  if (person) {
    // a data collector account that has no farm (for example removed from an earlier one): linked at once, no email needed
    Object.assign(doc, { member_id: person.user_id, status: 'active', accepted_at: new Date(), email_sent: false, email_error: '' });
    await doc.save();
    await Notification.create({ user_id: person.user_id, type: 'success', title: 'You joined a farm', message: `${nameOf(owner)} added you as a data collector.` }).catch(() => {});
    return memberView(doc);
  }
  await doc.save();
  const mail = await sendInvitationEmail(address, { publicMetadata: { farm: nameOf(owner), role: 'Data collector' } });
  doc.email_sent = !!mail.sent;
  doc.email_error = mail.error || '';
  if (mail.sent) { doc.sent_count += 1; doc.last_sent_at = new Date(); }
  await doc.save();
  return { ...memberView(doc), email_test_mode: !!mail.dry };
}

/** Sends a waiting invitation again (not more often than every ten minutes) and renews its date. */
export async function resendInvitation(owner, id) {
  const m = await FarmMember.findOne({ _id: id, user_id: owner.user_id, status: 'invited', role: 'collector' });
  if (!m) throw createHttpError(404, 'That invitation was not found.');
  if (m.last_sent_at && Date.now() - m.last_sent_at.getTime() < RESEND_AFTER_MS) throw createHttpError(429, 'The invitation was sent a moment ago. Wait a few minutes before sending it again.');
  const mail = await sendInvitationEmail(m.invited_email, { publicMetadata: { farm: nameOf(owner), role: 'Data collector' } });
  m.expires_at = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  m.email_sent = !!mail.sent;
  m.email_error = mail.error || '';
  if (mail.sent) { m.sent_count += 1; m.last_sent_at = new Date(); }
  await m.save();
  return { ...memberView(m), email_test_mode: !!mail.dry };
}

/** Cancels a waiting invitation or removes a member. Their entries stay in the farm's records. */
export async function endMembership(owner, id) {
  const m = await FarmMember.findOne({ _id: id, user_id: owner.user_id, status: { $in: ['invited', 'active'] } });
  if (!m) throw createHttpError(404, 'That person is not on your team.');
  const wasActive = m.status === 'active';
  m.status = 'removed';
  m.ended_as = wasActive ? 'removed' : 'cancelled';
  m.ended_at = new Date();
  await m.save();
  if (wasActive && m.member_id) await Notification.create({ user_id: m.member_id, type: 'info', title: 'Your access ended', message: `${nameOf(owner)} removed you from their farm team.` }).catch(() => {});
  return { id: String(m._id), ended_as: m.ended_as };
}

/* ------------------------------------------------------------------ activity */
const ENTRY_DATE = {
  'planting-records': 'planting_date', 'field-activities': 'activity_date', 'irrigation-records': 'irrigation_date', 'fertilizer-applications': 'application_date',
  'crop-protection-records': 'protection_date', 'crop-scouting-records': 'scouting_date', 'harvest-records': 'harvest_date',
};

/** Entries this week and the last entry, for each of the given accounts: everything they recorded in the farm (field work and greenhouse counts). */
export async function activityFor(owner, memberIds, since = new Date(Date.now() - 7 * 86_400_000)) {
  const out = new Map(memberIds.map((id) => [id, { week: 0, last: null }]));
  if (!memberIds.length) return out;
  const sources = [
    ...OPERATIONAL.map((p) => ({ Model: resourceByPath[p].model, key: '$recorded_by' })),
    { Model: FruitCount, key: '$entered_by' },
  ];
  const rows = await Promise.all(sources.map(({ Model, key }) => Model.aggregate([
    { $match: { user_id: owner, ...(key === '$entered_by' ? { entered_by: { $in: memberIds } } : { recorded_by: { $in: memberIds } }) } },
    { $group: { _id: key, week: { $sum: { $cond: [{ $gte: ['$created_at', since] }, 1, 0] } }, last: { $max: '$created_at' } } },
  ])));
  for (const list of rows) {
    for (const r of list) {
      const s = out.get(r._id);
      if (!s) continue;
      s.week += r.week;
      if (r.last && (!s.last || r.last > s.last)) s.last = r.last;
    }
  }
  return out;
}

const hintOf = (path, d) => {
  const pick = { 'field-activities': d.activity_type || d.description, 'irrigation-records': d.irrigation_method, 'fertilizer-applications': d.fertilizer_name, 'crop-protection-records': d.problem_name || d.treatment, 'crop-scouting-records': d.plant_health || d.growth_stage, 'harvest-records': d.grade || d.storage_location, 'planting-records': d.planting_method || d.seed_source };
  return pick[path] || '';
};

/** The latest entries one account recorded in the farm, newest first, from every kind of field record. */
export async function recentEntries(owner, actorId, limit = 10) {
  const per = await Promise.all(OPERATIONAL.map(async (path) => {
    const r = resourceByPath[path];
    const docs = await r.model.find({ user_id: owner, recorded_by: actorId }).sort({ created_at: -1 }).limit(limit).lean();
    return docs.map((d) => ({ kind: r.name, path, id: String(d._id), date: d[ENTRY_DATE[path]] || '', created_at: d.created_at, hint: hintOf(path, d) }));
  }));
  const counts = await FruitCount.find({ user_id: owner, entered_by: actorId }).sort({ created_at: -1 }).limit(limit).lean();
  const all = [
    ...per.flat(),
    ...counts.map((c) => ({ kind: 'Greenhouse count', path: 'greenhouse', id: String(c._id), date: c.count_date, created_at: c.created_at, hint: `${c.row_id} ${c.plant_label || ''} · ${c.recorded_count}`.trim() })),
  ];
  return all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit);
}

/** How many entries one account made today, across every kind of record. */
export async function entriesToday(owner, actorId) {
  const start = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const a = await activityFor(owner, [actorId], start);
  return a.get(actorId)?.week || 0;
}

/** What the apps need to know about the person's place on a farm team (sent with the profile). */
export async function farmTeamContext(profile) {
  if (profile?.user_type !== 'collector') return { role: 'manager' };
  const link = await farmOf(profile.user_id);
  const owner = link ? await Profile.findOne({ user_id: link.user_id }, 'full_name email').lean() : null;
  return { role: 'collector', linked: !!link, farm_manager: owner?.full_name || owner?.email || '' };
}
