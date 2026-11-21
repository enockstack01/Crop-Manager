import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { farmerOnly, loadProfile, requireActiveAccount } from '../middleware/profile.js';
import { farmContext } from '../middleware/farmContext.js';
import { addCollector, listTeam, memberDetail, removeMember, resendInvite, updateMember } from '../controllers/team.controller.js';
import { tasksGuard } from '../controllers/tasks.controller.js';
import { collectorDashboard } from '../controllers/collectorDashboard.controller.js';
import { resources } from '../resources.js';
import { genericRouter } from './generic.routes.js';
import { getDashboard } from '../controllers/dashboard.controller.js';
import { getRoleDashboard } from '../controllers/roleDashboard.controller.js';
import { search } from '../controllers/search.controller.js';
import { calculatorContext } from '../controllers/calculators.controller.js';
import { exportAll, exportResource, exportTables } from '../controllers/export.controller.js';
import { calendar } from '../controllers/calendar.controller.js';
import { getWeather, findPlace } from '../controllers/weather.controller.js';
import { getMe, updateMe, submitAccessRequest } from '../controllers/profile.controller.js';
import { adjustStock } from '../controllers/inventory.controller.js';
import uploadsRouter from './uploads.routes.js';
import adminRouter from './admin.routes.js';
import { orgRouter, publicJoin, selfRouter } from './org.routes.js';
import aiRouter from './ai.routes.js';
import greenhouseRouter from './greenhouse.routes.js';
import { markAllRead } from '../controllers/notifications.controller.js';
import { limiter as rateLimit } from '../lib/rateLimit.js';

const api = Router();

// public: the page behind a referral link asks which organization it belongs to (rate limited)
api.use(publicJoin);

// Everything below requires a signed-in Clerk user
api.use(requireAuth);
api.use(loadProfile);

// available to every signed-in user, approved or not (the request-access flow)
api.get('/profile', getMe);
api.get('/profile/me', getMe);
api.put('/profile', updateMe);
api.patch('/profile', updateMe);
api.post('/profile/access-request', submitAccessRequest);

// organization sign-up, joining through a referral link and leaving: also before approval
api.use(selfRouter);

// administrators only (requireAdmin inside)
api.use('/admin', adminRouter);

// farm data: approved (active) accounts only
api.use(requireActiveAccount);

// whose farm is this about? A data collector's request is moved onto their farm manager's farm, within what a collector may reach (lib/farmPolicy.js)
api.use(farmContext);

// organization workspace and notifications are the only things an organization account reaches below
api.use('/organizations', orgRouter);

api.use(['/dashboard', '/export', '/calendar', '/weather', '/calculators', '/search', '/uploads', '/ai', '/inventory-items', '/greenhouse', '/team'], farmerOnly);

api.get('/dashboard/collector', collectorDashboard); // the data collector's page: today's work
api.get('/dashboard', getDashboard);
api.get('/dashboard/role', getRoleDashboard);
api.get('/export', exportAll);
api.post('/export/tables', exportTables);
api.get('/export/:path', exportResource);
api.get('/calendar', calendar);
api.get('/weather', getWeather);
api.get('/calculators/context', calculatorContext);
api.get('/weather/geocode', findPlace);
api.get('/search', search);

api.use('/uploads', uploadsRouter);

// AI assistant: diagnosis reports, insights, advice, summaries, chat
api.use('/ai', aiRouter);

// greenhouse: crops, fruit counts with a photo check (Python and OpenCV fruit counter) and the greenhouse dashboard
api.use('/greenhouse', greenhouseRouter);

// resource-specific extras
api.post('/inventory-items/:id/stock', adjustStock);

// notifications: mark them all read in one request (before the generic /:id routes)
api.put('/notifications/read-all', markAllRead);

// the farm manager's team of data collectors (the farm manager only: a collector is refused by the policy before this)
api.get('/team', listTeam);
// invitations send real email: a farm manager can send a limited number an hour (a stolen session cannot be used to spam addresses)
const inviteLimit = rateLimit({ name: 'team-invite', windowMs: 3_600_000, max: Number(process.env.TEAM_INVITES_PER_HOUR || 30), standardHeaders: true, legacyHeaders: false, keyGenerator: (r) => r.userId, message: { message: 'You have sent many invitations. Please try again in an hour.' } });
api.post('/team', inviteLimit, addCollector);
api.get('/team/:id', memberDetail);
api.put('/team/:id', updateMember);
api.post('/team/:id/resend', inviteLimit, resendInvite);
api.delete('/team/:id', removeMember);

// tasks: the farm manager hands them out, a data collector marks their own done
api.use('/tasks', tasksGuard);

// generic CRUD for every declared resource
for (const resource of resources) {
  if (resource.path !== 'notifications') api.use(`/${resource.path}`, farmerOnly);
  api.use(`/${resource.path}`, genericRouter(resource).router);
}

export default api;
