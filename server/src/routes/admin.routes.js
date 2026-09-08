import { Router } from 'express';
import { requireAdmin } from '../middleware/admin.js';
import {
  overview,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  reseedUser,
  browseResource,
  getRecord,
  deleteRecord,
  resourceList,
  getSettings,
  addAdminEmail,
  removeAdminEmail,
} from '../controllers/admin.controller.js';

const router = Router();
router.use(requireAdmin);

router.get('/overview', overview);
router.get('/resources', resourceList);

router.get('/settings', getSettings);
router.post('/settings/admins', addAdminEmail);
router.delete('/settings/admins/:email', removeAdminEmail);

router.get('/users', listUsers);
router.get('/users/:userId', getUser);
router.patch('/users/:userId', updateUser);
router.delete('/users/:userId', deleteUser);
router.post('/users/:userId/reseed', reseedUser);

router.get('/data/:resource', browseResource);
router.get('/data/:resource/:id', getRecord);
router.delete('/data/:resource/:id', deleteRecord);

export default router;
