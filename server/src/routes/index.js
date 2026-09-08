import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resources } from '../resources.js';
import { genericRouter } from './generic.routes.js';
import { getDashboard } from '../controllers/dashboard.controller.js';
import { getMe, updateMe } from '../controllers/profile.controller.js';
import { adjustStock } from '../controllers/inventory.controller.js';
import uploadsRouter from './uploads.routes.js';

const api = Router();

// Everything below requires a signed-in Clerk user
api.use(requireAuth);

api.get('/dashboard', getDashboard);

api.get('/profile', getMe);
api.get('/profile/me', getMe);
api.put('/profile', updateMe);
api.patch('/profile', updateMe);

api.use('/uploads', uploadsRouter);

// resource-specific extras
api.post('/inventory-items/:id/stock', adjustStock);

// generic CRUD for every declared resource
for (const resource of resources) {
  api.use(`/${resource.path}`, genericRouter(resource).router);
}

export default api;
