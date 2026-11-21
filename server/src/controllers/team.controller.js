import mongoose from 'mongoose';
import createHttpError from '../lib/httpError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { FarmMember } from '../models/index.js';
import { activityFor, endMembership, inviteCollector, memberView, recentEntries, resendInvitation } from '../lib/farmTeam.js';

/*
 * The Team page: the farm manager's data collectors. Only the farm manager reaches these routes (a data collector gets 403 from the
 * policy before they get here). `req.userId` is the farm manager.
 */
const text = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/** Everyone on the team with this week's entries and the last activity. `?include=removed` adds the people who were removed or cancelled. */
export async function teamSummary(owner, { includeEnded = false } = {}) {
  const rows = await FarmMember.find({ user_id: owner, status: includeEnded ? { $in: ['invited', 'active', 'removed'] } : { $in: ['invited', 'active'] } }).sort({ created_at: 1 });
  const ids = rows.map((m) => m.member_id).filter(Boolean);
  const stats = await activityFor(owner, ids);
  return rows.map((m) => memberView(m, stats.get(m.member_id) || {}));
}

export const listTeam = asyncHandler(async (req, res) => {
  const members = await teamSummary(req.userId, { includeEnded: req.query.include === 'removed' });
  res.json({
    data: members,
    totals: {
      collectors: members.filter((m) => m.status === 'active' && m.role === 'collector').length,
      waiting: members.filter((m) => m.status === 'invited').length,
      entries_this_week: members.reduce((n, m) => n + m.week_entries, 0),
    },
  });
});

export const addCollector = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const member = await inviteCollector({ owner: req.profile, name: b.name, email: b.email, phone: b.phone });
  res.status(201).json(member);
});

const own = async (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw createHttpError(404, 'That person is not on your team.');
  const m = await FarmMember.findOne({ _id: req.params.id, user_id: req.userId });
  if (!m) throw createHttpError(404, 'That person is not on your team.');
  return m;
};

/** One member with their latest entries. */
export const memberDetail = asyncHandler(async (req, res) => {
  const m = await own(req);
  const stats = m.member_id ? await activityFor(req.userId, [m.member_id]) : new Map();
  res.json({ ...memberView(m, stats.get(m.member_id) || {}), recent: m.member_id ? await recentEntries(req.userId, m.member_id, 15) : [] });
});

/** Correct a collector's name or phone number. */
export const updateMember = asyncHandler(async (req, res) => {
  const m = await own(req);
  if (m.status === 'removed') throw createHttpError(409, 'That person was removed from your team.');
  const b = req.body || {};
  if (b.name !== undefined) {
    const n = text(b.name, 80);
    if (n.length < 2) throw createHttpError(400, 'Enter the collector\'s name.');
    m.name = n;
  }
  if (b.phone !== undefined) {
    const p = text(b.phone, 30);
    if (p && !/^[+0-9 ()\-.]{5,30}$/.test(p)) throw createHttpError(400, 'The phone number may contain digits, spaces and + - ( ) only.');
    m.phone = p;
  }
  await m.save();
  res.json(memberView(m));
});

export const resendInvite = asyncHandler(async (req, res) => {
  await own(req);
  res.json(await resendInvitation(req.profile, req.params.id));
});

/** Cancels a waiting invitation, or removes a collector: their access ends at once and the entries they made stay. */
export const removeMember = asyncHandler(async (req, res) => {
  await own(req);
  res.json(await endMembership(req.profile, req.params.id));
});
