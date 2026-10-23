import { asyncHandler } from '../lib/asyncHandler.js';
import { recordLoader } from '../lib/records.js';
import { tableFrom } from '../lib/export.js';
import { weatherForUser } from '../lib/weather.js';

/*
 * GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 * One list of dated events for the calendar grid, built from the farmer's own records: crop cycles
 * (planting, expected and actual harvest), field work, irrigation, fertilizer, crop protection, scouting,
 * harvests, equipment service, plus alerts (overdue harvests, stock that is low or expiring, service due,
 * heavy rain / heat / frost in the forecast). Web and mobile draw the same events.
 */
const OPEN = new Set(['Planned', 'Planted', 'Growing', 'Ready for Harvest']);
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const OK = /^\d{4}-\d{2}-\d{2}$/;

const cropOf = (r) => r.crops?.name || r.crop_cycles?.crops?.name || '';
const where = (r) => [r.farms?.name, r.fields?.name].filter(Boolean).join(' · ');
const withCrop = (r, rest) => [cropOf(r), rest, where(r)].filter(Boolean).join(' · ');

const SOURCES = [
  { path: 'field-activities', date: 'activity_date', type: 'activity', route: '/activities', title: (r) => r.activity_type || 'Field activity', sub: (r) => withCrop(r, r.description) },
  { path: 'irrigation-records', date: 'irrigation_date', type: 'irrigation', route: '/irrigation', title: (r) => `Irrigation${r.irrigation_method ? `: ${r.irrigation_method}` : ''}`, sub: (r) => withCrop(r, r.duration_hours ? `${r.duration_hours} h` : '') },
  { path: 'fertilizer-applications', date: 'application_date', type: 'fertilizer', route: '/fertilizers', title: (r) => `Fertilizer: ${r.fertilizer_name || r.fertilizer_type || ''}`.trim(), sub: (r) => withCrop(r, r.quantity ? `${r.quantity} ${r.unit || ''}` : '') },
  { path: 'crop-protection-records', date: 'protection_date', type: 'protection', route: '/crop-protection', title: (r) => `Protection: ${r.problem_name || r.problem_type || ''}`.trim(), sub: (r) => withCrop(r, r.treatment) },
  { path: 'crop-scouting-records', date: 'scouting_date', type: 'scouting', route: '/scouting', title: (r) => `Scouting${r.plant_health ? `: ${r.plant_health}` : ''}`, sub: (r) => withCrop(r, r.growth_stage) },
  { path: 'harvest-records', date: 'harvest_date', type: 'harvest', route: '/harvest', title: (r) => `Harvest: ${cropOf(r)} ${r.quantity ?? ''} ${r.unit || ''}`.trim(), sub: (r) => where(r) },
  { path: 'equipment-maintenance', date: 'maintenance_date', type: 'maintenance', route: '/maintenance', title: (r) => `Service: ${r.equipment?.name || r.type || 'equipment'}`, sub: (r) => r.description || '' },
];

function details(record) {
  const t = tableFrom([record]);
  return t.headers.map((h, i) => [h, t.rows[0][i]]).filter(([, v]) => v !== '' && v !== null && v !== undefined).slice(0, 14);
}

export const calendar = asyncHandler(async (req, res) => {
  const today = iso(new Date());
  const from = OK.test(String(req.query.from)) ? req.query.from : addDays(today, -31);
  const to = OK.test(String(req.query.to)) ? req.query.to : addDays(today, 62);
  const uid = req.userId;
  const events = [];
  const add = (e) => {
    const cut = e.title.indexOf(': '); // "Planting: Maize": the first part is a fixed phrase the app can translate
    events.push({ ...e, label: cut > 0 ? e.title.slice(0, cut) : e.title, name: cut > 0 ? e.title.slice(cut + 2) : '', status: e.status || (e.date < today ? 'done' : 'upcoming') });
  };
  const inRange = (d) => d && d >= from && d <= to;
  const range = (f) => ({ [f]: { $gte: from, $lte: to } });

  // crop cycles: planting, expected harvest, actual harvest
  const cycles = await recordLoader('crop-cycles', { filter: { $or: [range('planting_date'), range('expected_harvest_date'), range('actual_harvest_date')] }, limit: 500 })(uid);
  for (const c of cycles) {
    const crop = c.crops?.name || 'Crop';
    const place = where(c);
    if (inRange(c.planting_date)) add({ id: `c${c.id}p`, date: c.planting_date, type: 'planting', title: `${c.status === 'Planned' ? 'Planting planned' : 'Planting'}: ${crop}`, subtitle: place, route: '/crop-cycles', details: details(c) });
    if (inRange(c.expected_harvest_date) && OPEN.has(c.status)) {
      const late = c.expected_harvest_date < today;
      add({ id: `c${c.id}h`, date: c.expected_harvest_date, type: 'harvest', title: `Expected harvest: ${crop}`, subtitle: place, route: '/crop-cycles', status: late ? 'overdue' : undefined, details: details(c) });
    }
    if (inRange(c.actual_harvest_date)) add({ id: `c${c.id}a`, date: c.actual_harvest_date, type: 'harvest', title: `Harvested: ${crop}`, subtitle: place, route: '/crop-cycles', details: details(c) });
  }

  // dated records of every kind
  await Promise.all(SOURCES.map(async (s) => {
    const rows = await recordLoader(s.path, { filter: range(s.date), limit: 500 })(uid);
    for (const r of rows) add({ id: `${s.path}${r.id}`, date: r[s.date], type: s.type, title: s.title(r), subtitle: s.sub(r), route: s.route, details: details(r) });
  }));

  // service that is due
  const due = await recordLoader('equipment-maintenance', { filter: range('next_maintenance'), limit: 200 })(uid);
  for (const r of due) add({ id: `m${r.id}n`, date: r.next_maintenance, type: 'alert', title: `Service due: ${r.equipment?.name || r.type || 'equipment'}`, subtitle: r.description || '', route: '/maintenance', status: r.next_maintenance < today ? 'overdue' : 'upcoming', details: details(r) });

  // stock: expiring soon and running low
  const items = await recordLoader('inventory-items')(uid);
  for (const i of items) {
    if (i.expiry_date && inRange(i.expiry_date)) add({ id: `i${i.id}e`, date: i.expiry_date, type: 'alert', title: `${i.expiry_date < today ? 'Expired' : 'Expires'}: ${i.name}`, subtitle: `${i.current_quantity} ${i.unit}`, route: '/inventory', status: i.expiry_date < today ? 'overdue' : 'upcoming', details: details(i) });
    if (today >= from && today <= to && Number(i.current_quantity) <= Number(i.minimum_stock || 0) && Number(i.minimum_stock) > 0) {
      add({ id: `i${i.id}l`, date: today, type: 'alert', title: `Low stock: ${i.name}`, subtitle: `${i.current_quantity} ${i.unit} left, minimum ${i.minimum_stock}`, route: '/inventory', status: 'overdue', details: details(i) });
    }
  }

  // weather warnings for the days ahead
  try {
    const w = await weatherForUser(uid, {});
    if (w.located) {
      for (const d of w.daily) {
        if (!inRange(d.date) || d.date < today) continue;
        if ((d.rain_mm || 0) >= 20) add({ id: `w${d.date}r`, date: d.date, type: 'weather', title: `Heavy rain expected: ${d.rain_mm} mm`, subtitle: w.location.name, route: '/weather', status: 'alert' });
        if (d.tmax >= 34) add({ id: `w${d.date}h`, date: d.date, type: 'weather', title: `Very hot: ${Math.round(d.tmax)} °C`, subtitle: w.location.name, route: '/weather', status: 'alert' });
        if (d.tmin <= 3) add({ id: `w${d.date}f`, date: d.date, type: 'weather', title: `Cold night: ${Math.round(d.tmin)} °C`, subtitle: w.location.name, route: '/weather', status: 'alert' });
      }
    }
  } catch { /* the calendar works without weather */ }

  // seasons as date bands
  const seasons = await recordLoader('seasons')(uid);
  const bands = seasons.filter((s) => s.start_date && s.end_date && s.end_date >= from && s.start_date <= to).map((s) => ({ id: s.id, name: s.name, start: s.start_date, end: s.end_date, status: s.status }));

  events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  res.json({ from, to, today, events, bands });
});
