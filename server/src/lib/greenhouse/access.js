import createHttpError from '../httpError.js';
import { GreenhouseMember } from '../../models/index.js';

/*
 * Who may do what in the greenhouse tab.
 *
 *   owner      the farmer whose records they are: everything, including the 3D map, the layout and the team
 *   manager    a farm manager the owner invited: all the records, the disease details and the number of diseased plants.
 *              No 3D map or plan, no changes to the layout, crops or counts.
 *   collector  a data collector the owner invited: the plan view and recording (photos, counts, freezing a plant with a reason).
 *              No disease details, no dashboard, no layout, crops or team.
 *
 * A signed-in person works on their own farm unless the request names another farm in the X-Farm-Owner header; that is allowed only
 * when that farm's owner invited them and they accepted by signing in with the invited address.
 */
export const ROLES = ['owner', 'manager', 'collector'];

/** Sets req.gh = { owner, role, actor, actorName } for the farm this request is about, or refuses. */
export async function greenhouseContext(req, _res, next) {
  try {
    const named = String(req.headers['x-farm-owner'] || '').trim();
    req.gh = { owner: req.userId, role: 'owner', actor: req.userId, actorName: req.profile?.full_name || '' };
    if (named && named !== req.userId) {
      const m = await GreenhouseMember.findOne({ user_id: named, member_id: req.userId, status: 'active' }).lean();
      if (!m) throw createHttpError(403, 'You do not have access to that farm.');
      req.gh.owner = named;
      req.gh.role = m.role;
    }
    next();
  } catch (e) {
    next(e);
  }
}

/** Lets only the named roles through. */
export const only = (...roles) => (req, _res, next) => (roles.includes(req.gh?.role)
  ? next()
  : next(createHttpError(403, req.gh?.role === 'owner' ? 'Not allowed.' : 'Your role on this farm does not allow this.')));

/** Accepts the invitations written to the signed-in person's verified address. Returns the farms they can work on. */
export async function accessList(userId, profile) {
  const email = profile?.email_verified && profile?.email ? String(profile.email).toLowerCase() : null;
  if (email) {
    await GreenhouseMember.updateMany(
      { invited_email: email, status: 'invited' },
      { $set: { member_id: userId, status: 'active', name: profile.full_name || '' } },
    );
  }
  const mine = await GreenhouseMember.find({ member_id: userId, status: 'active' }).lean();
  return mine.map((m) => ({ owner_id: m.user_id, role: m.role }));
}

/** The accounts whose uploaded photos may belong to this farm's records: the owner and everyone invited. */
export async function uploadersOf(owner) {
  const m = await GreenhouseMember.find({ user_id: owner, status: 'active', member_id: { $ne: null } }).select('member_id').lean();
  return [owner, ...m.map((x) => x.member_id)];
}
