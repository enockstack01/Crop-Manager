import mongoose from 'mongoose';
import createHttpError from '../lib/httpError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { FarmMember, Task } from '../models/index.js';

/*
 * Tasks. The farm manager creates and edits them through the standard records routes (this file only checks who a task is for).
 * A data collector sees the tasks that are theirs or for everyone, and can mark them done (or open again): nothing else.
 */
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const mine = (owner, actor) => ({ user_id: owner, $or: [{ assigned_to: actor }, { assigned_to: '' }, { assigned_to: { $exists: false } }] });

const view = (t) => ({ ...t.toJSON(), field_id: t.field_id ? String(t.field_id) : null });

export const tasksGuard = asyncHandler(async (req, res, next) => {
  const collector = req.farmRole === 'collector';

  if (!collector) {
    // the farm manager: a task for one person must be for someone on the team; the name is filled in here
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && req.body.assigned_to !== undefined) {
      const id = text(req.body.assigned_to, 80);
      if (!id) {
        req.body.assigned_to = '';
        req.body.assigned_to_name = '';
      } else {
        const m = await FarmMember.findOne({ user_id: req.userId, member_id: id, status: 'active' }).lean();
        if (!m) throw createHttpError(400, 'Choose someone on your team, or leave it for everyone.');
        req.body.assigned_to = id;
        req.body.assigned_to_name = m.name || m.invited_email;
      }
    }
    // the done fields are set only by marking a task done (by the manager here, by the collector below), never taken from the request
    if (req.body) for (const k of ['done_at', 'done_by', 'done_by_name']) delete req.body[k];
    if (req.body && ['open', 'done'].includes(req.body.status)) {
      const id = req.path.replace(/^\//, '');
      const before = mongoose.isValidObjectId(id) ? await Task.findOne({ _id: id, user_id: req.userId }, 'status').lean() : null;
      if (!before || before.status !== req.body.status) { // an edit that leaves the status as it was keeps who completed it
        if (req.body.status === 'done') Object.assign(req.body, { done_at: new Date(), done_by: req.actorId, done_by_name: req.profile?.full_name || '' });
        else Object.assign(req.body, { done_at: null, done_by: '', done_by_name: '', completion_note: '' });
      }
    }
    return next();
  }

  // a data collector
  const owner = req.userId;
  const actor = req.actorId;
  if (req.method === 'GET' && (req.path === '/' || req.path === '')) {
    const filter = mine(owner, actor);
    if (['open', 'done'].includes(req.query.status)) filter.status = req.query.status;
    const rows = await Task.find(filter).sort({ status: -1, due_date: 1, created_at: -1 }).limit(200);
    return res.json({ data: rows.map(view), page: 1, perPage: 200, total: rows.length, totalPages: 1 });
  }
  const id = req.path.replace(/^\//, '');
  if (!mongoose.isValidObjectId(id)) throw createHttpError(404, 'Task not found');
  const task = await Task.findOne({ _id: id, ...mine(owner, actor) });
  if (!task) throw createHttpError(404, 'Task not found');
  if (req.method === 'GET') return res.json(view(task));
  if (!['PUT', 'PATCH'].includes(req.method)) throw createHttpError(403, 'Only the farm manager creates or deletes tasks.');

  const b = req.body || {};
  const extra = Object.keys(b).filter((k) => !['status', 'completion_note'].includes(k));
  if (extra.length) throw createHttpError(403, 'You can mark a task done or open again. The farm manager changes the rest.');
  if (!['open', 'done'].includes(b.status)) throw createHttpError(400, 'Mark the task done or open.');
  if (b.status === 'open' && task.status === 'done' && task.done_by !== actor) throw createHttpError(403, 'Someone else completed this task.');
  task.status = b.status;
  if (b.status === 'done') {
    task.done_at = new Date();
    task.done_by = actor;
    task.done_by_name = req.profile?.full_name || '';
    task.completion_note = text(b.completion_note, 500);
  } else {
    task.done_at = null;
    task.done_by = '';
    task.done_by_name = '';
    task.completion_note = '';
  }
  await task.save();
  return res.json(view(task));
});
