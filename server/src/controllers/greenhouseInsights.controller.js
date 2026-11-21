import mongoose from 'mongoose';
import createHttpError from '../lib/httpError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { GreenhouseCrop, FruitCount, GreenhouseHouse } from '../models/index.js';
import { estimate, history, DEFAULT_RISK } from '../lib/greenhouse/revenue.js';
import { theftAlerts } from '../lib/greenhouse/alerts.js';
import { positionsOf, keyOf } from '../lib/greenhouse/layout.js';

/*
 * What the farm owner and the farm manager look at over time (value history, theft alerts), and the first page of each role:
 * the manager's overview of the farm and the data collector's list of what to record today.
 */
const text = (v, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const FIELDS = 'crop_id crop_name greenhouse row_id plant_label recorded_count fruit_size verification.status verification.detected verification.confidence verification.message verification.health count_date created_at entered_by entered_by_name alerts_ack';

async function load(owner) {
  const [houses, crops, counts] = await Promise.all([
    GreenhouseHouse.find({ user_id: owner }).lean(),
    GreenhouseCrop.find({ user_id: owner }).lean(),
    FruitCount.find({ user_id: owner }).sort({ count_date: -1, created_at: -1 }).limit(20000).select(FIELDS).lean(),
  ]);
  return { houses, crops, counts };
}
const riskOf = (q) => (q.risk === undefined ? DEFAULT_RISK : Number(q.risk) / 100);

/** The harvest value as it stood at the end of each of the last weeks. */
export const revenueHistory = asyncHandler(async (req, res) => {
  const { houses, crops, counts } = await load(req.gh.owner);
  const weeks = Math.min(52, Math.max(2, Number(req.query.weeks) || 12));
  res.json({ weeks: history({ houses, counts, crops, risk: riskOf(req.query), greenhouse: text(req.query.greenhouse, 80) || null, weeks }), note: 'Each week uses only the counts made by the end of that week, with today\'s prices and weights.' });
});

/** Plants whose numbers do not add up: the photo shows more than was recorded, or a count fell with nothing to explain it. */
export const alerts = asyncHandler(async (req, res) => {
  const { counts } = await load(req.gh.owner);
  const windowDays = Math.min(180, Math.max(7, Number(req.query.days) || 30));
  res.json(theftAlerts({ counts, today: today(), greenhouse: text(req.query.greenhouse, 80) || null, opts: { windowDays } }));
});

/** Explain an alert (harvested, pruned, wind, pests...) so it stops counting as open, or open it again. Owner and farm manager. */
export const ackAlert = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw createHttpError(404, 'Fruit count not found');
  const b = req.body || {};
  const kind = text(b.kind, 20);
  if (!['under_recorded', 'fall'].includes(kind)) throw createHttpError(400, 'kind must be under_recorded or fall.');
  const doc = await FruitCount.findOne({ _id: req.params.id, user_id: req.gh.owner });
  if (!doc) throw createHttpError(404, 'Fruit count not found');
  const ack = { ...(doc.alerts_ack || {}) };
  if (b.state === 'open') {
    delete ack[kind];
  } else {
    const reason = text(b.reason, 300);
    if (reason.length < 3) throw createHttpError(400, 'Say what explains it, for example harvested on Tuesday, pruned, or wind damage.');
    ack[kind] = { reason, by: req.gh.actor, by_name: req.gh.actorName || '', at: new Date().toISOString() };
  }
  doc.alerts_ack = ack;
  doc.markModified('alerts_ack');
  await doc.save();
  res.json({ id: String(doc._id), kind, ack: ack[kind] || null });
});

const VERDICT_TEXT = { match: 'matches the photo', close: 'close to the photo', mismatch: 'does not match the photo', inconclusive: 'photo check not sure', not_checked: 'photo not checked', failed: 'photo check failed' };

/** The first page of the signed-in role: the manager (and owner) see the farm, the data collector sees what to record. */
export const overview = asyncHandler(async (req, res) => {
  const { houses, crops, counts } = await load(req.gh.owner);
  const t = today();

  if (req.gh.role === 'collector') {
    const mine = counts.filter((c) => c.entered_by === req.gh.actor);
    const week = mine.filter((c) => c.count_date >= daysAgo(6));
    const latest = new Map(); // the latest count of each plant by anyone: a plant counted by a colleague needs no second count
    for (const c of counts) { const k = `${c.greenhouse}|${keyOf(c.row_id, c.plant_label)}`; if (!latest.has(k)) latest.set(k, c); }
    const todo = [];
    const frozen = [];
    for (const h of houses) {
      let active = 0;
      let doneThisWeek = 0;
      const next = [];
      for (const pos of positionsOf(h)) {
        const key = keyOf(pos.row_id, pos.plant_label);
        const st = h.positions?.[key];
        if (st?.state === 'inactive') continue;
        if (st?.state === 'frozen') frozen.push({ greenhouse: h.name, row_id: pos.row_id, plant_label: pos.plant_label, reason: st.reason || '' });
        active += 1;
        const c = latest.get(`${h.name}|${key}`);
        if (c && c.count_date >= daysAgo(6)) doneThisWeek += 1;
        else next.push({ row_id: pos.row_id, plant_label: pos.plant_label, last: c ? c.count_date : null });
      }
      todo.push({ id: String(h._id), name: h.name, active_positions: active, counted_this_week: doneThisWeek, remaining: next.length, next: next.slice(0, 12) });
    }
    const row = (c) => ({ id: String(c._id), greenhouse: c.greenhouse, row_id: c.row_id, plant_label: c.plant_label, crop_name: c.crop_name, recorded_count: c.recorded_count, count_date: c.count_date, status: c.verification?.status || 'not_checked', result: VERDICT_TEXT[c.verification?.status] || 'photo not checked' });
    return res.json({
      role: 'collector',
      today: { counts: mine.filter((c) => c.count_date === t).length, fruit: mine.filter((c) => c.count_date === t).reduce((s, c) => s + c.recorded_count, 0) },
      week: { counts: week.length, fruit: week.reduce((s, c) => s + c.recorded_count, 0) },
      todo,
      recount: mine.filter((c) => c.verification?.status === 'mismatch' && c.count_date >= daysAgo(14)).slice(0, 5).map(row), // verdict only: a collector never sees disease details
      recent: mine.slice(0, 8).map(row),
      frozen: frozen.slice(0, 20),
    });
  }

  const est = estimate({ houses, counts, crops, today: t });
  const hist = history({ houses, counts, crops, weeks: 8, today: t });
  const al = theftAlerts({ counts, today: t });
  const T = est.totals;
  const people = new Map();
  for (const c of counts) {
    if (c.count_date < daysAgo(6)) continue;
    const k = c.entered_by || 'unknown';
    const p = people.get(k) || { name: c.entered_by_name || 'Owner', counts: 0, fruit: 0 };
    p.counts += 1;
    p.fruit += c.recorded_count;
    people.set(k, p);
  }
  res.json({
    role: req.gh.role,
    headline: {
      fruit: T.fruit, healthy_fruit: T.healthy_fruit, loss_share_pct: T.loss_share_pct, sick_plants: T.sick_plants, counted_plants: T.counted_plants, active_plants: T.active_plants,
      unchecked_plants: T.unchecked_plants, whole_fruit_net: T.whole_fruit_net,
      money: est.money.map((m) => ({ currency: m.currency, gross: m.gross, net: m.net, whole_net: m.whole_net, loss: m.loss })),
    },
    houses: est.by_house.map((h) => ({ id: h.id, name: h.name, active_positions: h.active_positions, counted_plants: h.counted_plants, uncounted_plants: h.uncounted_plants, stale_plants: h.stale_plants, sick_plants: h.sick_plants, frozen_plants: h.frozen_plants, fruit: h.fruit, loss_share_pct: h.loss_share_pct })),
    trend: hist.map((w) => ({ week: w.week, fruit: w.fruit, loss_share_pct: w.loss_share_pct, sick_plants: w.sick_plants, net: w.money[0]?.net ?? null, currency: w.money[0]?.currency || null })),
    alerts: { summary: al.summary, top: al.alerts.filter((a) => !a.ack).slice(0, 5), people: al.people.filter((p) => p.flagged) },
    diseased: est.sick_list.slice(0, 6),
    activity: { counts_this_week: [...people.values()].reduce((s, p) => s + p.counts, 0), people: [...people.values()].sort((a, b) => b.counts - a.counts).slice(0, 8) },
    notes: est.notes,
  });
});
