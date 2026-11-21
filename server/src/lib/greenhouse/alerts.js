import { keyOf } from './layout.js';

/*
 * Theft and loss alerts: plants whose numbers do not add up. Computed on the fly from the counts, nothing is stored except the explanation
 * an owner or farm manager gives for an alert.
 *
 *   under_recorded  the photo shows clearly more fruit than the person recorded (the photo check says "does not match" and the
 *                   photo count is the higher one). Fruit may have been taken and not written down.
 *   fall            a plant's count dropped a lot since its last count, with no harvest to explain it: measured on the recorded number and on the
 *                   photo count. When the photo shows fewer fruit but the recorded number did not follow, it is the strongest sign.
 *   person          one person's counts are often below what the photos show (a pattern, not a single plant).
 *
 * Alerts are signals to look into, not accusations: fruit also drops because of harvest, pruning, wind, pests and disease, which is why each
 * alert can be explained and then stops counting as open.
 */
export const DEFAULTS = { windowDays: 30, gapDays: 21, minFruit: 5, minDrop: 3, dropShare: 0.3, underShare: 0.25, personMin: 5, personShare: 0.4 };

const day = (iso) => Date.parse(`${iso}T00:00:00Z`);
const daysBetween = (a, b) => Math.round((day(b) - day(a)) / 86400000);
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

const sure = (c) => c.verification?.detected != null && c.verification?.confidence !== 'low' && ['match', 'close', 'mismatch'].includes(c.verification?.status);
const photoOf = (c) => (sure(c) ? c.verification.detected : null);

function describe(c) {
  return { count_id: String(c._id), date: c.count_date, recorded: c.recorded_count, photo: photoOf(c), entered_by: c.entered_by || '', entered_by_name: c.entered_by_name || '' };
}
const ackOf = (c, kind) => c.alerts_ack?.[kind] || null;

/**
 * @param counts  fruit counts, newest first
 * @param today   'YYYY-MM-DD'
 */
export function theftAlerts({ counts, today, greenhouse = null, opts = {} }) {
  const o = { ...DEFAULTS, ...opts };
  const since = iso(day(today) - o.windowDays * 86400000);
  const list = counts.filter((c) => !greenhouse || c.greenhouse === greenhouse);
  const alerts = [];

  // 1. the photo shows more than was recorded
  for (const c of list) {
    if (c.count_date < since || (c.fruit_size && c.fruit_size !== 'all')) continue;
    const v = c.verification;
    if (!v || v.status !== 'mismatch' || v.detected == null || v.confidence === 'low') continue;
    const diff = v.detected - c.recorded_count;
    if (diff < o.minDrop || diff < v.detected * o.underShare) continue;
    alerts.push({
      kind: 'under_recorded', severity: c.recorded_count <= v.detected * 0.5 || diff >= 10 ? 'high' : 'medium',
      greenhouse: c.greenhouse, row_id: c.row_id, plant_label: c.plant_label, crop_name: c.crop_name,
      to: describe(c), difference: diff, count_id: String(c._id), date: c.count_date, ack: ackOf(c, 'under_recorded'),
      message: `The photo shows ${v.detected} fruit but ${c.recorded_count} were recorded (${diff} fewer).`,
    });
  }

  // 2. a fall between two counts of the same plant
  const byPlant = new Map();
  for (const c of list) {
    if (c.fruit_size && c.fruit_size !== 'all') continue;
    const k = `${c.greenhouse}|${keyOf(c.row_id, c.plant_label)}|${c.crop_id}`;
    if (!byPlant.has(k)) byPlant.set(k, []);
    byPlant.get(k).push(c); // newest first
  }
  for (const arr of byPlant.values()) {
    for (let i = 0; i < arr.length - 1; i += 1) {
      const b = arr[i]; // the newer count
      const a = arr[i + 1]; // the one before it
      if (b.count_date < since || b.count_date === a.count_date) continue;
      const gap = daysBetween(a.count_date, b.count_date);
      if (gap > o.gapDays) continue;
      const fell = (from, to) => from != null && to != null && from >= o.minFruit && from - to >= Math.max(o.minDrop, from * o.dropShare);
      const recFell = fell(a.recorded_count, b.recorded_count);
      const photoFell = fell(photoOf(a), photoOf(b));
      if (!recFell && !photoFell) continue;
      const from = recFell ? a.recorded_count : photoOf(a);
      const to = recFell ? b.recorded_count : photoOf(b);
      const dropPct = Math.round(((from - to) / from) * 100);
      const unrecorded = photoFell && !recFell; // the photo shows fewer fruit, but the number written down did not follow
      alerts.push({
        kind: 'fall', severity: unrecorded || (recFell && photoFell) || dropPct >= 60 ? 'high' : 'medium',
        greenhouse: b.greenhouse, row_id: b.row_id, plant_label: b.plant_label, crop_name: b.crop_name,
        from: describe(a), to: describe(b), days: gap, drop: from - to, drop_pct: dropPct, basis: recFell ? 'recorded' : 'photo',
        count_id: String(b._id), date: b.count_date, ack: ackOf(b, 'fall'),
        message: unrecorded
          ? `The photo shows ${from - to} fewer fruit than ${gap} day${gap === 1 ? '' : 's'} ago (${photoOf(a)} to ${photoOf(b)}), but the recorded number stayed at ${b.recorded_count}.`
          : `The count fell from ${from} to ${to} (${dropPct}%) in ${gap} day${gap === 1 ? '' : 's'}${photoFell ? ', and the photos agree' : ''}.`,
      });
    }
  }

  // 3. a person whose counts are often below the photos
  const people = new Map();
  for (const c of list) {
    if (c.count_date < since || !c.entered_by || !['match', 'close', 'mismatch'].includes(c.verification?.status)) continue;
    const p = people.get(c.entered_by) || { entered_by: c.entered_by, name: c.entered_by_name || '', decided: 0, under: 0, over: 0 };
    p.decided += 1;
    if (c.verification.status === 'mismatch') { if (c.verification.detected > c.recorded_count) p.under += 1; else p.over += 1; }
    people.set(c.entered_by, p);
  }
  const persons = [...people.values()].map((p) => ({ ...p, under_share: p.decided ? Math.round((p.under / p.decided) * 100) : 0, flagged: p.decided >= o.personMin && p.under / p.decided >= o.personShare }));

  const rank = { high: 0, medium: 1 };
  alerts.sort((x, y) => rank[x.severity] - rank[y.severity] || (x.date < y.date ? 1 : -1));
  const open = alerts.filter((a) => !a.ack);
  return {
    window_days: o.windowDays,
    summary: { total: alerts.length, open: open.length, open_high: open.filter((a) => a.severity === 'high').length, explained: alerts.length - open.length, people_flagged: persons.filter((p) => p.flagged).length },
    alerts,
    people: persons.sort((a, b) => b.under_share - a.under_share),
  };
}
