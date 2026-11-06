import { FarmerInvite, Profile } from '../../models/index.js';
import { attachFarmer, queueReferredFarmer } from './core.js';
import { sendInvitationEmail } from './invite.js';

/*
 * Inviting farmers to an organization by email. Used by the system administrator's bulk import and by the organization's own staff.
 * A farmer who already has an account is linked at once (the organization confirmed the farmer agreed to share a summary);
 * one who has no account gets an emailed invitation and is linked at the first sign-in with that address.
 */
export const INVITE_DAYS = 30;
export const RESEND_AFTER_MS = 10 * 60_000; // an invitation can be sent again this long after the last send
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Email addresses from a pasted list or CSV (any separator), lower case, no duplicates. */
export function parseEmails(input) {
  const raw = Array.isArray(input) ? input.join('\n') : String(input || '');
  const found = raw.split(/[\s,;]+/).map((e) => e.replace(/^"|"$/g, '').trim().toLowerCase()).filter((e) => e && e !== 'email');
  return [...new Set(found)];
}

/**
 * @returns {{joined:number, invited:number, rows:Array<{email:string,result:string,detail?:string}>}}
 */
export async function inviteFarmerEmails({ org, emails, actorId }) {
  const result = { joined: 0, invited: 0, rows: [] };
  let stop = false;
  for (const email of emails) {
    if (stop) { result.rows.push({ email, result: 'limit_reached' }); continue; }
    if (!isEmail(email)) { result.rows.push({ email, result: 'invalid_email' }); continue; }
    const profile = await Profile.findOne({ email: new RegExp(`^${escapeRegex(email)}$`, 'i') }).lean();
    if (!profile) {
      const expires = new Date(Date.now() + INVITE_DAYS * 86_400_000);
      const invite = await FarmerInvite.findOneAndUpdate(
        { organization_id: org._id, email },
        { $set: { status: 'invited', expires_at: expires, invited_by: actorId }, $setOnInsert: { organization_id: org._id, email } },
        { upsert: true, new: true }
      );
      const mail = await sendInvitationEmail(email, { publicMetadata: { organization: org.name } });
      invite.email_sent = mail.sent;
      invite.email_error = mail.error;
      if (mail.sent) { invite.sent_count += 1; invite.last_sent_at = new Date(); }
      await invite.save();
      result.invited += 1;
      result.rows.push({ email, result: mail.sent ? 'invited' : mail.dry ? 'invited_test' : 'invite_not_sent', detail: mail.error || undefined });
      continue;
    }
    if (profile.is_admin || profile.user_type === 'org') { result.rows.push({ email, result: 'not_a_farmer' }); continue; }
    try {
      await attachFarmer({ farmerId: profile.user_id, org, consentSource: 'bulk_import' });
      await queueReferredFarmer(profile, org); // linked to the organization, still waits for the administrator's approval
      result.joined += 1;
      result.rows.push({ email, result: 'joined' });
    } catch (err) {
      const code = err?.details?.code || 'error';
      if (code === 'org_limit') stop = true;
      result.rows.push({ email, result: code });
    }
  }
  return result;
}

/** What the invitation list shows: an invitation past its date reads as expired. */
export const inviteView = (i) => ({
  id: String(i._id),
  email: i.email,
  status: i.status === 'invited' && i.expires_at <= new Date() ? 'expired' : i.status,
  expires_at: i.expires_at,
  email_sent: i.email_sent,
  email_error: i.email_error || '',
  sent_count: i.sent_count,
  last_sent_at: i.last_sent_at,
  joined_at: i.joined_at,
  created_at: i.created_at,
});
