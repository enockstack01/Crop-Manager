import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { orgAccess } from '../lib/orgs/access.js';
import * as org from '../controllers/org.controller.js';

const limiter = (max, keyGenerator, message) =>
  rateLimit({ windowMs: 60_000, max, standardHeaders: true, legacyHeaders: false, keyGenerator, message: { message } });

// Public link check: limited per IP address and, separately, per device (the apps send x-device-id),
// so a token cannot be guessed by hammering one address or one phone.
const byIp = (req) => req.ip;
const byDevice = (req) => `${req.headers['x-device-id'] || 'none'}|${req.headers['user-agent'] || ''}`;
export const publicJoin = Router();
publicJoin.get(
  '/join/:token',
  limiter(30, byIp, 'Too many attempts. Please wait a minute.'),
  limiter(20, byDevice, 'Too many attempts. Please wait a minute.'),
  org.joinInfo
);

/** Signed-in routes that must work before the account is approved (sign-up, joining through a link). */
export const selfRouter = Router();
selfRouter.post('/organizations/register', limiter(10, (r) => r.userId, 'Too many attempts.'), org.registerOrganization);
selfRouter.post('/join/:token', limiter(20, (r) => r.userId, 'Too many attempts. Please wait a minute.'), limiter(30, byIp, 'Too many attempts.'), org.joinOrganization);
selfRouter.get('/me/organization', org.myOrganization);
selfRouter.post('/me/organization/leave', org.leaveOrganization);

/** Organization workspace: every route checks membership and role on the server. */
export const orgRouter = Router();
const any = orgAccess(['org_admin', 'org_staff']);
const adminOnly = orgAccess(['org_admin']);
orgRouter.get('/:orgId', any, org.getOrganization);
orgRouter.patch('/:orgId', adminOnly, org.updateOrganization);
orgRouter.get('/:orgId/members', adminOnly, org.listMembers);
orgRouter.post('/:orgId/members', adminOnly, org.inviteMember);
orgRouter.delete('/:orgId/members/:memberId', adminOnly, org.removeMember);
orgRouter.post('/:orgId/referral-links', any, org.createLink);
orgRouter.get('/:orgId/referral-links', any, org.listLinks);
orgRouter.delete('/:orgId/referral-links/:linkId', adminOnly, org.revokeLink);
orgRouter.get('/:orgId/farmers', any, org.getFarmers);
orgRouter.delete('/:orgId/farmers/:farmerId', adminOnly, org.removeFarmer);
orgRouter.get('/:orgId/dashboard', any, org.getDashboard);
