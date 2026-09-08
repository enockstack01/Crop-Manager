import createHttpError from '../lib/httpError.js';
import { Profile } from '../models/index.js';

/**
 * Runs after requireAuth on every /api route:
 *  - ensures a Profile row exists for the user
 *  - stamps last_seen_at
 *  - attaches `req.profile`
 *  - blocks deactivated (non-admin) accounts
 */
export async function loadProfile(req, _res, next) {
  try {
    const profile = await Profile.findOneAndUpdate(
      { user_id: req.userId },
      { $set: { last_seen_at: new Date() }, $setOnInsert: { user_id: req.userId, role: 'Farmer' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    if (profile.is_active === false && !profile.is_admin) {
      return next(createHttpError(403, 'Your account has been deactivated. Contact an administrator.'));
    }

    req.profile = profile;
    next();
  } catch (err) {
    next(err);
  }
}
