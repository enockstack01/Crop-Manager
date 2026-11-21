import createHttpError from '../lib/httpError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { CropCycle, CropScoutingRecord, Field, Profile, Task } from '../models/index.js';
import { entriesToday, recentEntries, activityFor } from '../lib/farmTeam.js';
import { OPERATIONAL } from '../lib/farmPolicy.js';
import { resourceByPath } from '../resources.js';

/*
 * The data collector's page: what to do today and what they did. Nothing about money, reports or the rest of the team.
 *   entries today / this week, the buttons to record (one per kind of field record), their open tasks, the fields that need a check, and
 *   their own latest entries.
 */
const OPEN_STAGES = ['Planned', 'Planted', 'Growing', 'Ready for Harvest'];
const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const CHECK_AFTER_DAYS = 7;

export const collectorDashboard = asyncHandler(async (req, res) => {
  if (req.farmRole !== 'collector') throw createHttpError(403, 'This is the data collector\'s page.');
  const owner = req.userId;
  const actor = req.actorId;
  const now = Date.now();
  const today = iso(now);

  const [today_n, weekStats, tasks, fields, cycles, scouting, recent, manager] = await Promise.all([
    entriesToday(owner, actor),
    activityFor(owner, [actor], new Date(now - 6 * DAY)),
    Task.find({ user_id: owner, status: 'open', $or: [{ assigned_to: actor }, { assigned_to: '' }, { assigned_to: { $exists: false } }] }).sort({ due_date: 1, created_at: -1 }).limit(30).lean(),
    Field.find({ user_id: owner }, 'name farm_id').lean(),
    CropCycle.find({ user_id: owner, status: { $in: OPEN_STAGES } }, 'field_id').lean(),
    CropScoutingRecord.aggregate([{ $match: { user_id: owner, field_id: { $ne: null } } }, { $group: { _id: '$field_id', last: { $max: '$scouting_date' } } }]),
    recentEntries(owner, actor, 10),
    Profile.findOne({ user_id: owner }, 'full_name').lean(),
  ]);

  // the fields that need a check: fields with a crop growing in them (all fields when none has) that were not scouted in the last week
  const growing = new Set(cycles.map((c) => String(c.field_id)));
  const pool = fields.filter((f) => growing.has(String(f._id)));
  const candidates = pool.length ? pool : fields;
  const last = new Map(scouting.map((s) => [String(s._id), s.last]));
  const cutoff = iso(now - CHECK_AFTER_DAYS * DAY);
  const needsCheck = candidates
    .map((f) => ({ id: String(f._id), name: f.name, last_checked: last.get(String(f._id)) || null }))
    .filter((f) => !f.last_checked || f.last_checked < cutoff)
    .sort((a, b) => (a.last_checked || '') < (b.last_checked || '') ? -1 : 1)
    .slice(0, 8);

  res.json({
    role: 'collector',
    farm_manager: manager?.full_name || '',
    today: { entries: today_n, date: today },
    week: { entries: weekStats.get(actor)?.week || 0 },
    record: OPERATIONAL.map((p) => ({ path: p, label: resourceByPath[p].name })).concat([{ path: 'greenhouse', label: 'Greenhouse count' }]),
    tasks: {
      open: tasks.length,
      overdue: tasks.filter((t) => t.due_date && t.due_date < today).length,
      items: tasks.slice(0, 8).map((t) => ({ id: String(t._id), title: t.title, due_date: t.due_date, priority: t.priority, overdue: !!(t.due_date && t.due_date < today), mine: t.assigned_to === actor, field_id: t.field_id ? String(t.field_id) : null })),
    },
    needs_check: needsCheck,
    recent,
  });
});
