import { Notification, Profile } from '../models/index.js';

/** Statuses an administrator can set, and the message the account owner then sees. */
export const STATUS_NOTICES = {
  active: { type: 'success', title: 'Account approved', message: 'Your CropManager account is active. Welcome aboard!' },
  on_hold: { type: 'warning', title: 'Account on hold', message: 'Your CropManager account has been put on hold.' },
  rejected: { type: 'danger', title: 'Access request rejected', message: 'Your request for a CropManager account was not approved.' },
  deactivated: { type: 'danger', title: 'Account deactivated', message: 'Your CropManager account has been deactivated.' },
};

/** Fields to $set when an account moves to `status` (keeps the legacy is_active flag in sync). */
export function statusPatch(status, byUserId, reason = '') {
  return {
    account_status: status,
    is_active: status === 'active',
    status_reason: reason,
    status_updated_at: new Date(),
    status_updated_by: byUserId || null,
  };
}

/** Notify every administrator (bell notifications) — e.g. a new access request. */
export async function notifyAdmins({ type = 'info', title, message }) {
  const admins = await Profile.find({ is_admin: true }, 'user_id').lean();
  if (!admins.length) return;
  await Notification.insertMany(admins.map((a) => ({ user_id: a.user_id, type, title, message })));
}

/**
 * One-off upgrade for accounts created before access requests existed: they keep
 * their access (active, or deactivated if they had been switched off) and are not
 * asked to fill in the request form. Safe to run on every start.
 */
export async function migrateAccountStatuses() {
  const missing = { account_status: { $exists: false } };
  // in order: switched-off accounts first, then everyone else that is left
  const deactivated = await Profile.updateMany(
    { ...missing, is_active: false, is_admin: { $ne: true } },
    { $set: { account_status: 'deactivated' } }
  );
  const active = await Profile.updateMany(missing, { $set: { account_status: 'active', is_active: true } });
  const n = (deactivated.modifiedCount || 0) + (active.modifiedCount || 0);
  if (n) console.log(`[migrate] set account_status on ${n} existing profile(s)`);
}
