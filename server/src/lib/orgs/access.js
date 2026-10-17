import mongoose from 'mongoose';
import createHttpError from '../httpError.js';
import { Organization, OrganizationMember } from '../../models/index.js';

/**
 * Per-request permission check for every /organizations/:orgId route. It runs on the server for
 * every call: a user reaches only the organization they are an active member of, with the roles the
 * route allows, whatever id they put in the URL. System administrators can open any organization.
 * A suspended organization is read-only for its own users.
 */
export function orgAccess(roles = ['org_admin', 'org_staff']) {
  return async (req, _res, next) => {
    try {
      const { orgId } = req.params;
      if (!mongoose.isValidObjectId(orgId)) throw createHttpError(404, 'Organization not found');
      const org = await Organization.findById(orgId);
      if (!org) throw createHttpError(404, 'Organization not found');

      const isAdmin = !!req.profile?.is_admin;
      let membership = null;
      if (!isAdmin) {
        membership = await OrganizationMember.findOne({ organization_id: org._id, user_id: req.userId, status: 'active' }).lean();
        // same answer for "does not exist" and "not yours", so ids cannot be probed
        if (!membership) throw createHttpError(404, 'Organization not found');
        if (!roles.includes(membership.role)) throw createHttpError(403, 'You do not have permission to do this');
        if (org.status === 'suspended' && req.method !== 'GET') {
          throw createHttpError(403, 'This organization is suspended. You can view data but not change it.', { code: 'org_suspended' });
        }
      }
      req.org = org;
      req.membership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}
