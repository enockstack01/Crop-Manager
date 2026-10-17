import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { loadProfile, requireActiveAccount } from '../middleware/profile.js';
import { resources } from '../resources.js';
import { genericRouter } from './generic.routes.js';
import { getDashboard } from '../controllers/dashboard.controller.js';
import { getMe, updateMe, submitAccessRequest } from '../controllers/profile.controller.js';
import { adjustStock } from '../controllers/inventory.controller.js';
import uploadsRouter from './uploads.routes.js';
import adminRouter from './admin.routes.js';
import { orgRouter, publicJoin, selfRouter } from './org.routes.js';
import aiRouter from './ai.routes.js';

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

api.get('/dashboard', getDashboard);

// organization workspace (membership and role are checked inside)
api.use('/organizations', orgRouter);

api.use('/uploads', uploadsRouter);

// AI assistant (Anthropic): diagnosis reports, insights, advice, summaries, chat
api.use('/ai', aiRouter);

// resource-specific extras
api.post('/inventory-items/:id/stock', adjustStock);

// generic CRUD for every declared resource
for (const resource of resources) {
  api.use(`/${resource.path}`, genericRouter(resource).router);
}

export default api;
