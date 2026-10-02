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

const api = Router();

// Everything below requires a signed-in Clerk user
api.use(requireAuth);
api.use(loadProfile);

// available to every signed-in user, approved or not (the request-access flow)
api.get('/profile', getMe);
api.get('/profile/me', getMe);
api.put('/profile', updateMe);
api.patch('/profile', updateMe);
api.post('/profile/access-request', submitAccessRequest);

// administrators only (requireAdmin inside)
api.use('/admin', adminRouter);

// farm data: approved (active) accounts only
api.use(requireActiveAccount);

api.get('/dashboard', getDashboard);

api.use('/uploads', uploadsRouter);

// resource-specific extras
api.post('/inventory-items/:id/stock', adjustStock);

// generic CRUD for every declared resource
for (const resource of resources) {
  api.use(`/${resource.path}`, genericRouter(resource).router);
}

export default api;
