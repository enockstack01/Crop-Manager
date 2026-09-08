import createHttpError from '../lib/httpError.js';

/** Requires `req.profile.is_admin` (set by loadProfile). */
export function requireAdmin(req, _res, next) {
  if (!req.profile?.is_admin) return next(createHttpError(403, 'Administrator access required'));
  next();
}
