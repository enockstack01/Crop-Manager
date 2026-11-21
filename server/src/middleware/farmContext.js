import createHttpError from '../lib/httpError.js';
import { FarmMember, Profile } from '../models/index.js';
import { collectorMayCall } from '../lib/farmPolicy.js';

/*
 * Whose farm is this request about?
 *
 * Every farm record is stored under its owner's id (the farm manager) and every route reads `req.userId` as that owner. So for a data
 * collector the request is simply moved onto their manager's farm: from here on `req.userId` IS the manager, and the real person is kept in
 * `req.actorId`. Every module then works for a collector with no change of its own, and this file is the one place that decides what they may
 * reach (lib/farmPolicy.js).
 *
 *   req.actorId    the signed-in person
 *   req.farmOwner  the farm manager whose records these are (the same person for a farm manager)
 *   req.farmRole   'manager' for the owner of the records, 'collector' for a data collector
 *   req.farmLink   (collectors) the team membership
 *
 * A collector whose access ended (removed by the manager) is told so and reaches nothing.
 * Runs after requireActiveAccount: a collector who is not approved yet never gets here.
 */
export async function farmContext(req, _res, next) {
  try {
    req.actorId = req.userId;
    req.farmOwner = req.userId;
    req.farmRole = 'manager';
    if (req.profile?.user_type !== 'collector' || req.profile?.is_admin) return next();

    const link = await FarmMember.findOne({ member_id: req.actorId, status: 'active', role: 'collector' });
    if (!link) throw createHttpError(403, 'Your access to the farm has ended. Ask your farm manager to add you again.', { code: 'collector_unlinked' });

    // a collector works on their manager's farm only while the manager's account is active (an administrator can put it on hold or deactivate it)
    const boss = await Profile.findOne({ user_id: link.user_id }, 'account_status is_admin').lean();
    if (!boss || (!boss.is_admin && boss.account_status !== 'active')) throw createHttpError(403, "Your farm manager's account is not active, so the farm is closed for now.", { code: 'farm_inactive' });

    const verdict = collectorMayCall(req.method, req.path);
    if (!verdict.ok) throw createHttpError(403, verdict.why, { code: 'collector_forbidden' });

    req.farmOwner = link.user_id;
    req.farmRole = 'collector';
    req.farmLink = link;
    req.userId = link.user_id; // from here on the request is about the manager's farm
    if (/^\/?notifications(\/|$)/.test(req.path)) req.userId = req.actorId; // a person's notifications are theirs, not the farm's

    // the last time they used the farm, for the Team page (written at most every five minutes)
    if (!link.last_activity_at || Date.now() - link.last_activity_at.getTime() > 5 * 60_000) {
      FarmMember.updateOne({ _id: link._id }, { $set: { last_activity_at: new Date() } }).catch(() => {});
    }
    next();
  } catch (e) {
    next(e);
  }
}
