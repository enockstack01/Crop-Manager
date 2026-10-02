import createHttpError from '../lib/httpError.js';
import { Profile } from '../models/index.js';

/**
 * Runs after requireAuth on every /api route:
 *  - ensures a Profile row exists for the user (new sign-ups start as `new`)
 *  - stamps last_seen_at
 *  - attaches `req.profile`
 */
export async function loadProfile(req, _res, next) {
  try {
    req.profile = await Profile.findOneAndUpdate(
      { user_id: req.userId },
      { $set: { last_seen_at: new Date() }, $setOnInsert: { user_id: req.userId, role: 'Farmer' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    next();
  } catch (err) {
    next(err);
  }
}

const BLOCKED = {
  new: 'Please submit your account request to get access.',
  pending: 'Your account request is awaiting approval by an administrator.',
  on_hold: 'Your account is on hold. Contact an administrator.',
  rejected: 'Your account request was not approved.',
  deactivated: 'Your account has been deactivated. Contact an administrator.',
};

/** Farm data is only for approved (active) accounts; administrators always pass. */
export function requireActiveAccount(req, _res, next) {
  const { is_admin: isAdmin, account_status: status } = req.profile || {};
  if (isAdmin || status === 'active') return next();
  const err = createHttpError(403, BLOCKED[status] || 'Your account is not active.');
  err.details = { account_status: status };
  next(err);
}
