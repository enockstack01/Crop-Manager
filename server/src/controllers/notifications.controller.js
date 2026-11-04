import { asyncHandler } from '../lib/asyncHandler.js';
import { Notification } from '../models/system.models.js';

/** PUT /api/notifications/read-all  Marks every unread notification of the signed-in user as read, in one request. */
export const markAllRead = asyncHandler(async (req, res) => {
  const r = await Notification.updateMany({ user_id: req.userId, is_read: false }, { $set: { is_read: true } });
  res.json({ updated: r.modifiedCount ?? 0 });
});
