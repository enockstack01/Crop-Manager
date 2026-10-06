import { formatCompact } from './valueLabels.js';
import { getCurrency } from '../../lib/format.js';
import { t } from '../../i18n/index.js';

/*
 * Dashboard "Key insights" and activity feed, computed from the /dashboard payload
 * (same idea as LivestockPro's shared/analytics.js and dashboardFeed.js). Each insight
 * is a figure, a 2-4 word label and a small chart; the full sentence is kept for the
 * tile's tooltip / accessible name. Mirrored in mobile/src/features/dashboard/insights.ts.
 */

const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const num = (v) => Number(v) || 0;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const money = (v, c) => `${c} ${formatCompact(v)}`;
const MONTH = (key) => new Date(`${key}-01T00:00:00`).toLocaleString('en', { month: 'short' });
const monthKey = (offset) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - offset);
  return iso(d).slice(0, 7);
};

/**
 * @param d       the /dashboard payload
 * @param scope   the dashboard filters (farm, from, to)
 * @param currency the currency the dashboard's charts are in
 * @returns [{ id, tone: good|warn|bad|info, label, sentence, viz }]
 */
export function computeInsights(d, scope, currency) {
  const farmOk = (r) => !scope.farm || r.farm_id === scope.farm;
  const inRange = (date) => (!scope.from || !date || date >= scope.from) && (!scope.to || !date || date <= scope.to);
  const cur = currency || getCurrency();
  const inCur = (r) => (r.currency || getCurrency()) === cur;

  const harvests = (d.harvests || []).filter((h) => farmOk(h) && inRange(h.harvest_date));
  const cycles = (d.cycles || []).filter(farmOk);
  const expenses = (d.expenses || []).filter((e) => farmOk(e) && inRange(e.expense_date) && inCur(e));
  const sales = (d.sales || []).filter((s) => farmOk(s) && inRange(s.sale_date) && inCur(s));
  const scouting = (d.scouting || []).filter(farmOk);
  const inventory = d.inventory || [];
  const out = [];

  // 1. yield: last 6 months vs the 6 before (kg per harvested hectare)
  const cut6 = iso(new Date(Date.now() - 182 * DAY));
  const cut12 = iso(new Date(Date.now() - 365 * DAY));
  const yieldOf = (rows) => {
    const area = rows.reduce((s, h) => s + num(h.harvested_area), 0);
    return area > 0 ? rows.reduce((s, h) => s + num(h.quantity), 0) / area : 0;
  };
  const recent = yieldOf(harvests.filter((h) => h.harvest_date >= cut6));
  const before = yieldOf(harvests.filter((h) => h.harvest_date >= cut12 && h.harvest_date < cut6));
  if (recent && before) {
    const change = Math.round(((recent - before) / before) * 100);
    out.push({
      id: 'yield',
      tone: change >= 0 ? 'good' : 'bad',
      label: t('Yield trend'),
      sentence: t(change >= 0
        ? 'Average yield is {{yield}} kg/ha over the last 6 months, {{pct}}% higher than the 6 months before.'
        : 'Average yield is {{yield}} kg/ha over the last 6 months, {{pct}}% lower than the 6 months before.', { yield: formatCompact(recent), pct: Math.abs(change) }),
      viz: { kind: 'trend', dir: change >= 0 ? 'up' : 'down', figure: `${change >= 0 ? '+' : ''}${change}%`, bars: [{ label: t('Before'), value: Math.round(before) }, { label: t('Last 6 mo'), value: Math.round(recent) }], unit: 'kg/ha' },
    });
  } else if (recent || before) {
    const y = recent || before;
    out.push({
      id: 'yield', tone: 'info', label: t('Average yield'),
      sentence: t('Average yield is {{yield}} kg per harvested hectare.', { yield: formatCompact(y) }),
      viz: { kind: 'figure', figure: formatCompact(y), sub: 'kg/ha', icon: 'wheat-awn' },
    });
  }

  // 2. profit margin (one currency)
  const revenue = sales.reduce((s, x) => s + num(x.total_amount), 0);
  const spent = expenses.reduce((s, x) => s + num(x.amount), 0);
  if (revenue || spent) {
    const net = revenue - spent;
    const margin = revenue > 0 ? Math.round((net / revenue) * 100) : -100;
    out.push({
      id: 'margin',
      tone: margin >= 20 ? 'good' : margin >= 0 ? 'warn' : 'bad',
      label: t('Profit margin'),
      sentence: t(net >= 0 ? 'Net profit is {{net}} on {{sales}} of sales — a {{margin}}% margin.' : 'Net loss is {{net}} on {{sales}} of sales — a {{margin}}% margin.',
        { net: money(Math.abs(net), cur), sales: money(revenue, cur), margin }),
      viz: { kind: 'ring', pct: Math.max(0, margin), figure: `${margin}%`, sub: t('{{amount}} net', { amount: `${net >= 0 ? '' : '−'}${money(Math.abs(net), cur)}` }) },
    });
  }

  // 3. spending: last 6 months
  const months = [5, 4, 3, 2, 1, 0].map(monthKey);
  const byMonth = Object.fromEntries(months.map((m) => [m, 0]));
  expenses.forEach((e) => {
    const k = (e.expense_date || '').slice(0, 7);
    if (k in byMonth) byMonth[k] += num(e.amount);
  });
  const spend = months.map((m) => byMonth[m]);
  if (spend.some(Boolean)) {
    const avg = spend.slice(0, 5).reduce((s, v) => s + v, 0) / 5;
    const latest = spend[5];
    const high = avg > 0 && latest > avg * 1.2;
    out.push({
      id: 'spend',
      tone: high ? 'warn' : 'info',
      label: `${t('Spending')} · ${cur}`,
      sentence: avg
        ? t('Spent {{amount}} this month against a {{avg}} monthly average.', { amount: money(latest, cur), avg: money(avg, cur) })
        : t('Spent {{amount}} this month.', { amount: money(latest, cur) }),
      viz: { kind: 'columns', figure: money(latest, cur), sub: t('this month'), bars: months.map((m, i) => ({ label: MONTH(m), value: spend[i] })) },
    });
  }

  // 4. harvest target: actual vs expected for harvested / completed cycles
  const done = cycles.filter((c) => ['Harvested', 'Completed'].includes(c.status) && num(c.expected_production) > 0);
  if (done.length) {
    const ids = new Set(done.map((c) => c.id));
    const actual = (d.harvests || []).filter((h) => ids.has(h.crop_cycle_id?.id || h.crop_cycle_id)).reduce((s, h) => s + num(h.quantity), 0)
      || done.reduce((s, c) => s + num(c.actual_production), 0);
    const expected = done.reduce((s, c) => s + num(c.expected_production), 0);
    const p = pct(actual, expected);
    out.push({
      id: 'target',
      tone: p >= 90 ? 'good' : p >= 60 ? 'warn' : 'bad',
      label: t('Harvest vs target'),
      sentence: t('Harvested {{actual}} kg of the {{expected}} kg expected from finished crop cycles ({{pct}}%).', { actual: formatCompact(actual), expected: formatCompact(expected), pct: p }),
      viz: { kind: 'meter', figure: `${p}%`, sub: `${formatCompact(actual)} / ${formatCompact(expected)} kg`, value: actual, max: Math.max(expected, actual) },
    });
  }

  // 5. crop health from scouting
  if (scouting.length) {
    const healthy = scouting.filter((s) => s.plant_health === 'Healthy').length;
    const observed = scouting.filter((s) => s.plant_health === 'Under Observation').length;
    const atRisk = scouting.filter((s) => s.plant_health === 'At Risk').length;
    out.push({
      id: 'health',
      tone: atRisk ? 'bad' : observed ? 'warn' : 'good',
      label: t('Crop health'),
      sentence: t('Of {{total}} recent scouting reports, {{healthy}} healthy, {{observed}} under observation and {{atRisk}} at risk.', { total: scouting.length, healthy, observed, atRisk }),
      viz: { kind: 'split', figure: atRisk ? t('{{count}} at risk', { count: atRisk }) : t('{{pct}}% healthy', { pct: pct(healthy, scouting.length) }), parts: [
        { key: 'healthy', label: t('Healthy'), value: healthy, tone: 'good' },
        { key: 'observed', label: t('Observed'), value: observed, tone: 'warn' },
        { key: 'atRisk', label: t('At risk'), value: atRisk, tone: 'bad' },
      ] },
    });
  }

  // 6. stock
  if (inventory.length) {
    const outOf = inventory.filter((i) => num(i.current_quantity) <= 0).length;
    const low = inventory.filter((i) => num(i.current_quantity) > 0 && num(i.current_quantity) <= num(i.minimum_stock)).length;
    const ok = inventory.length - outOf - low;
    out.push({
      id: 'stock',
      tone: outOf ? 'bad' : low ? 'warn' : 'good',
      label: t('Stock levels'),
      sentence: t('{{ok}} of {{total}} inventory items are stocked; {{low}} low and {{out}} out of stock.', { ok, total: inventory.length, low, out: outOf }),
      viz: { kind: 'split', figure: outOf + low ? t('{{count}} need restock', { count: outOf + low }) : t('All stocked'), parts: [
        { key: 'ok', label: t('Stocked'), value: ok, tone: 'good' },
        { key: 'low', label: t('Low'), value: low, tone: 'warn' },
        { key: 'out', label: t('Out'), value: outOf, tone: 'bad' },
      ] },
    });
  }

  // 7. harvests due in the next 4 weeks
  const now = Date.now();
  const weeks = [0, 1, 2, 3].map(() => 0);
  cycles.forEach((c) => {
    if (!c.expected_harvest_date || !['Planted', 'Growing', 'Ready for Harvest'].includes(c.status)) return;
    const days = Math.floor((new Date(c.expected_harvest_date) - now) / DAY);
    if (days >= 0 && days < 28) weeks[Math.floor(days / 7)] += 1;
  });
  const due = weeks.reduce((s, v) => s + v, 0);
  out.push({
    id: 'due',
    tone: due ? 'info' : 'good',
    label: t('Harvests due · 4 wks'),
    sentence: due
      ? t('{{count}} crop cycle(s) expected to be ready for harvest in the next 4 weeks.', { count: due })
      : t('No harvests are expected in the next 4 weeks.'),
    viz: { kind: 'columns', figure: String(due), sub: t(due === 1 ? 'harvest' : 'harvests'), bars: weeks.map((v, i) => ({ label: t('W{{n}}', { n: i + 1 }), value: v })), plain: true },
  });

  return out;
}

/* ------------------------------------------------------------------ feed */

export const relativeDay = (date) => {
  if (!date) return '';
  const days = Math.round((new Date(`${date.slice(0, 10)}T00:00:00`) - new Date(iso(new Date()) + 'T00:00:00')) / DAY);
  if (days === 0) return t('Today');
  if (days === -1) return t('Yesterday');
  if (days === 1) return t('Tomorrow');
  if (days < 0) return days > -7 ? t('{{count}} days ago', { count: -days }) : new Date(date).toLocaleDateString('en', { day: 'numeric', month: 'short' });
  return t('in {{count}} days', { count: days });
};

const ACTIVITY_ICON = {
  'Land Preparation': ['tractor', 'orange'], Ploughing: ['tractor', 'orange'], Harrowing: ['tractor', 'orange'],
  Planting: ['seedling', 'green'], Weeding: ['leaf', 'green'], Fertilization: ['flask', 'purple'],
  Irrigation: ['droplet', 'blue'], Spraying: ['spray-can', 'purple'], Scouting: ['magnifying-glass', 'green'],
  Harvest: ['wheat-awn', 'orange'], Transport: ['truck', 'blue'], Machinery: ['gears', 'blue'],
};

/** Recent activity: rows plus counts for the last 12 weeks. */
export function computeActivity(d, scope) {
  const rows = (d.activities || []).filter((a) => !scope.farm || a.farm_id === scope.farm);
  const start = new Date(iso(new Date()) + 'T00:00:00').getTime() - 83 * DAY; // 12 weeks incl. this one
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const s = new Date(start + i * 7 * DAY);
    return { label: s.toLocaleDateString('en', { day: 'numeric', month: 'short' }), count: 0 };
  });
  rows.forEach((a) => {
    const t = new Date(`${(a.activity_date || '').slice(0, 10)}T00:00:00`).getTime();
    const w = Math.floor((t - start) / (7 * DAY));
    if (w >= 0 && w < 12) weeks[w].count += 1;
  });
  const items = rows.slice(0, 6).map((a) => {
    const [icon, color] = ACTIVITY_ICON[a.activity_type] || ['list-check', 'green'];
    return {
      id: a.id,
      icon,
      color,
      name: t(a.activity_type || 'Activity'),
      sub: [a.description, [a.farms?.name, a.fields?.name].filter(Boolean).join(' / ')].filter(Boolean).join(' · '),
      date: a.activity_date,
      cost: num(a.total_cost) ? `${a.currency || getCurrency()} ${formatCompact(a.total_cost)}` : null,
    };
  });
  return { items, weeks };
}

export const UPCOMING_DAYS = 30;

/** Harvests expected in the next 30 days, soonest first. */
export function computeUpcoming(d, scope) {
  const today = new Date(iso(new Date()) + 'T00:00:00').getTime();
  return (d.cycles || [])
    .filter((c) => (!scope.farm || c.farm_id === scope.farm) && c.expected_harvest_date && ['Planned', 'Planted', 'Growing', 'Ready for Harvest'].includes(c.status))
    .map((c) => {
      const date = new Date(`${c.expected_harvest_date.slice(0, 10)}T00:00:00`);
      const daysLeft = Math.round((date - today) / DAY);
      return {
        id: c.id,
        daysLeft,
        day: date.getDate(),
        month: date.toLocaleString('en', { month: 'short' }),
        name: t('{{crop}} harvest', { crop: c.crops?.name || t('Crop') }),
        sub: [c.farms?.name, c.fields?.name].filter(Boolean).join(' / '),
        ready: c.status === 'Ready for Harvest',
      };
    })
    .filter((e) => e.daysLeft >= 0 && e.daysLeft <= UPCOMING_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

// labels are translated where they are shown
export const ALERT_KINDS = {
  stock: { label: 'Stock', icon: 'boxes-stacked', color: 'orange' },
  harvest: { label: 'Harvest', icon: 'wheat-awn', color: 'blue' },
  health: { label: 'Crop health', icon: 'heart-pulse', color: 'red' },
  overdue: { label: 'Overdue', icon: 'clock', color: 'red' },
};

/** Alerts with a kind (for the filter chips), a tone and an optional day count. */
export function computeAlerts(d, scope) {
  const farmOk = (r) => !scope.farm || r.farm_id === scope.farm;
  const today = new Date(iso(new Date()) + 'T00:00:00').getTime();
  const out = [];
  (d.inventory || []).forEach((i) => {
    if (num(i.current_quantity) <= 0) out.push({ id: `out-${i.id}`, kind: 'stock', tone: 'red', icon: 'boxes-stacked', name: i.name, sub: t('Out of stock'), link: '/inventory' });
    else if (num(i.current_quantity) <= num(i.minimum_stock)) out.push({ id: `low-${i.id}`, kind: 'stock', tone: 'orange', icon: 'boxes-stacked', name: i.name, sub: t('Low stock · {{qty}} left', { qty: `${formatCompact(i.current_quantity)} ${i.unit || ''}`.trim() }), link: '/inventory' });
  });
  (d.cycles || []).filter(farmOk).forEach((c) => {
    const name = `${c.crops?.name || t('Crop')}${c.fields?.name ? ` · ${c.fields.name}` : ''}`;
    const due = c.expected_harvest_date ? Math.round((new Date(`${c.expected_harvest_date.slice(0, 10)}T00:00:00`) - today) / DAY) : null;
    if (c.status === 'Ready for Harvest') out.push({ id: `ready-${c.id}`, kind: 'harvest', tone: 'blue', icon: 'wheat-awn', name, sub: t('Ready for harvest'), days: due, link: '/crop-cycles' });
    else if (['Planted', 'Growing'].includes(c.status) && due !== null && due < 0) out.push({ id: `late-${c.id}`, kind: 'overdue', tone: 'red', icon: 'clock', name, sub: t('Harvest date passed'), days: due, link: '/crop-cycles' });
  });
  (d.scouting || []).filter((s) => farmOk(s) && s.plant_health === 'At Risk').slice(0, 5).forEach((s) => {
    out.push({ id: `risk-${s.id}`, kind: 'health', tone: 'red', icon: 'triangle-exclamation', name: t('{{crop}} at {{farm}}', { crop: s.crops?.name || t('Crop'), farm: s.farms?.name || t('farm') }), sub: t('At-risk scouting report'), link: '/scouting' });
  });
  return out;
}
