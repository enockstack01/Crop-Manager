import { Router } from 'express';
import { requireAdmin } from '../middleware/admin.js';
import {
  overview,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  browseResource,
  resourceList,
} from '../controllers/admin.controller.js';

const router = Router();
router.use(requireAdmin);

router.get('/overview', overview);
router.get('/resources', resourceList);
router.get('/users', listUsers);
router.get('/users/:userId', getUser);
router.patch('/users/:userId', updateUser);
router.delete('/users/:userId', deleteUser);
router.get('/data/:resource', browseResource);

export default router;
