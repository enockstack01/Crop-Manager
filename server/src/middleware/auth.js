import { getAuth } from '@clerk/express';
import createHttpError from '../lib/httpError.js';
import { env } from '../config/env.js';

/**
 * Requires a valid Clerk session. Populates `req.userId` with the Clerk user id,
 * which every model uses as its ownership key (replacing the Supabase auth uid).
 *
 * Testing escape hatch: when NOT in production AND `ALLOW_DEV_AUTH=1` is set, an
 * `x-dev-user` header is accepted as the user id. This lets integration tests and
 * `curl` hit the API without a browser session. It is OFF unless explicitly enabled.
 */
export function requireAuth(req, _res, next) {
  if (!env.isProd && process.env.ALLOW_DEV_AUTH === '1' && req.headers['x-dev-user']) {
    req.userId = String(req.headers['x-dev-user']);
    return next();
  }
  const { userId } = getAuth(req);
  if (!userId) return next(createHttpError(401, 'Authentication required'));
  req.userId = userId;
  next();
}
