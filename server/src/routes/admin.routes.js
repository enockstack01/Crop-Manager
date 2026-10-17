import { Router } from 'express';
import { requireAdmin } from '../middleware/admin.js';
import { orgAccess } from '../lib/orgs/access.js';
import * as oa from '../controllers/orgAdmin.controller.js';
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
  setAiLimits,
  addAdminEmail,
  removeAdminEmail,
} from '../controllers/admin.controller.js';

const router = Router();
router.use(requireAdmin);

router.get('/overview', overview);
router.get('/resources', resourceList);

router.get('/settings', getSettings);
router.put('/settings/ai-limits', setAiLimits);
router.post('/settings/admins', addAdminEmail);
router.delete('/settings/admins/:email', removeAdminEmail);

// organizations: approval queue, limits, suspension, members, links, bulk import, audit log, settings
router.get('/organizations', oa.listOrganizations);
router.post('/organizations', oa.createOrganizationAdmin);
router.get('/organizations/:orgId', orgAccess(), oa.getOrganizationAdmin);
router.patch('/organizations/:orgId', orgAccess(), oa.updateOrganizationAdmin);
router.delete('/organizations/:orgId', orgAccess(), oa.deleteOrganizationAdmin);
router.post('/organizations/:orgId/import-farmers', orgAccess(), oa.importFarmers);
router.get('/platform-stats', oa.platformStats);
router.get('/audit-logs', oa.listAuditLogs);
router.get('/settings/organizations', oa.getOrgSettingsAdmin);
router.put('/settings/organizations', oa.putOrgSettingsAdmin);

router.get('/users', listUsers);
router.get('/users/:userId', getUser);
router.patch('/users/:userId', updateUser);
router.delete('/users/:userId', deleteUser);
router.post('/users/:userId/reseed', reseedUser);

router.get('/data/:resource', browseResource);
router.get('/data/:resource/:id', getRecord);
router.delete('/data/:resource/:id', deleteRecord);

export default router;
