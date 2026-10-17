import * as M from '../../models/index.js';

/*
 * Organization dashboard and farmer list, crop production only: farms, fields, crop cycles, planting,
 * field activities, irrigation, fertilizer, crop protection, scouting and harvests. Finances, inventory and
 * equipment are never read here. Only farmers with an ACTIVE link to the organization are included, so a farmer
 * who leaves disappears from the next request. Results are cached for ten minutes per organization and filter.
 */
const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const AREA = { hectares: 1, acres: 0.404686, 'square metres': 0.0001 };
const toHa = (v, unit) => n(v) * (AREA[unit] ?? 1);
const KG = { kg: 1, tonnes: 1000 };
const toKg = (v, unit) => (unit in KG ? n(v) * KG[unit] : 0);
const OPEN = ['Planned', 'Planted', 'Growing', 'Ready for Harvest'];
const DAY = 86_400_000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);

/** every collection that counts as "recorded farm activity" and the field that holds its date */
const ACTIVITY_MODELS = [M.FieldActivity, M.PlantingRecord, M.IrrigationRecord, M.FertilizerApplication, M.CropProtectionRecord, M.CropScoutingRecord, M.HarvestRecord];

async function lastActivity(ids) {
  const out = {};
  const parts = await Promise.all(
    ACTIVITY_MODELS.map((Model) =>
      Model.aggregate([{ $match: { user_id: { $in: ids } } }, { $group: { _id: '$user_id', last: { $max: '$created_at' } } }])
    )
  );
  for (const rows of parts) for (const r of rows) if (!out[r._id] || r.last > out[r._id]) out[r._id] = r.last;
  return out;
}

/** The organization's active farmers and their crop data, narrowed by district. */
async function load(org, { district = '' } = {}) {
  const links = await M.FarmerOrganization.find({ organization_id: org._id, status: 'active' }).lean();
  let ids = links.map((l) => l.farmer_id);
  const [profiles, farmsAll] = await Promise.all([
    M.Profile.find({ user_id: { $in: ids } }, 'user_id full_name email location').lean(),
    M.Farm.find({ user_id: { $in: ids } }, 'user_id name district province total_area area_unit').lean(),
  ]);
  const farms = district ? farmsAll.filter((f) => (f.district || '').toLowerCase() === district.toLowerCase()) : farmsAll;
  if (district) {
    const keep = new Set(farms.map((f) => f.user_id));
    ids = ids.filter((id) => keep.has(id));
  }
  const farmIds = new Set(farms.map((f) => String(f._id)));
  const [fields, cycles, crops] = await Promise.all([
    M.Field.find({ user_id: { $in: ids } }, 'user_id farm_id name area area_unit latitude longitude').lean(),
    M.CropCycle.find({ user_id: { $in: ids } }, 'user_id farm_id field_id crop_id status area_planted area_unit expected_production expected_production_unit expected_harvest_date').lean(),
    M.Crop.find({ user_id: { $in: ids } }, 'name').lean(),
  ]);
  const cropName = Object.fromEntries(crops.map((c) => [String(c._id), c.name]));
  const profileOf = Object.fromEntries(profiles.map((p) => [p.user_id, p]));
  return {
    links,
    ids,
    profileOf,
    farms,
    fields: fields.filter((f) => !district || farmIds.has(String(f.farm_id))),
    cycles: cycles.filter((c) => !district || farmIds.has(String(c.farm_id))).map((c) => ({ ...c, crop: (cropName[String(c.crop_id)] || '').trim() || '—' })),
  };
}

const nameOf = (p) => p?.full_name || p?.email || '—';

/* ------------------------------------------------------------------ dashboard */
const cache = new Map();
const TTL = 10 * 60_000;

export async function buildDashboard(org, filters, settings, { fresh = false } = {}) {
  const key = `${org._id}|${JSON.stringify(filters)}|${org.farmer_count}`;
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < TTL) return hit.data;

  const now = Date.now();
  const today = iso(now);
  const from = filters.from || '';
  const to = filters.to || '';
  const inRange = (d) => (!from || d >= from) && (!to || d <= to);
  const d = await load(org, filters);
  const ids = d.ids;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [last, harvests, acts, scouting, protection] = await Promise.all([
    lastActivity(ids),
    M.HarvestRecord.find({ user_id: { $in: ids } }, 'user_id crop_id quantity unit harvest_date').lean(),
    M.FieldActivity.find({ user_id: { $in: ids } }, 'user_id activity_type activity_date description crop_cycle_id').sort({ activity_date: -1 }).limit(4000).lean(),
    M.CropScoutingRecord.find({ user_id: { $in: ids } }, 'user_id crop_id scouting_date pest_observation disease_observation plant_health').sort({ scouting_date: -1 }).limit(1500).lean(),
    M.CropProtectionRecord.find({ user_id: { $in: ids } }, 'user_id problem_name problem_type severity protection_date').sort({ protection_date: -1 }).limit(1500).lean(),
  ]);
  const cropIds = [...new Set([...harvests.map((h) => String(h.crop_id)), ...scouting.map((s) => String(s.crop_id))])].filter((x) => x && x !== 'null');
  const cropDocs = cropIds.length ? await M.Crop.find({ _id: { $in: cropIds } }, 'name').lean() : [];
  const cropName = Object.fromEntries(cropDocs.map((c) => [String(c._id), c.name]));

  // overview
  const activeSince = now - settings.inactive_days * DAY;
  const activeFarmers = ids.filter((id) => last[id] && new Date(last[id]).getTime() >= activeSince).length;
  const overview = {
    farmers: ids.length,
    new_this_month: d.links.filter((l) => ids.includes(l.farmer_id) && new Date(l.joined_at) >= monthStart).length,
    active_farmers: activeFarmers,
    inactive_days: settings.inactive_days,
    usage: { count: org.farmer_count, max: org.max_farmers, pct: org.max_farmers > 0 ? Math.round((org.farmer_count / org.max_farmers) * 100) : 100 },
  };

  // farms and land
  const farmHa = d.farms.reduce((s, f) => s + toHa(f.total_area, f.area_unit), 0);
  const byDistrict = {};
  for (const f of d.farms) {
    const key2 = f.district || '—';
    byDistrict[key2] = byDistrict[key2] || { district: key2, farmers: new Set(), farms: 0, ha: 0 };
    byDistrict[key2].farmers.add(f.user_id);
    byDistrict[key2].farms += 1;
    byDistrict[key2].ha += toHa(f.total_area, f.area_unit);
  }
  const farmName = Object.fromEntries(d.farms.map((f) => [String(f._id), f.name]));
  const land = {
    farms: d.farms.length,
    total_ha: farmHa,
    avg_ha: d.farms.length ? farmHa / d.farms.length : 0,
    fields: d.fields.length,
    by_district: Object.values(byDistrict).map((x) => ({ district: x.district, farmers: x.farmers.size, farms: x.farms, ha: x.ha })).sort((a, b) => b.ha - a.ha),
    points: d.fields.filter((f) => f.latitude != null && f.longitude != null).slice(0, 600).map((f) => ({
      lat: f.latitude, lng: f.longitude, name: f.name, farm: farmName[String(f.farm_id)] || '', ha: toHa(f.area, f.area_unit),
    })),
  };

  // crops: area and farmers per crop, stage of the season, expected against recorded harvest
  const open = d.cycles.filter((c) => OPEN.includes(c.status));
  const crops = {};
  for (const c of open) {
    const row = (crops[c.crop.toLowerCase()] = crops[c.crop.toLowerCase()] || {
      name: c.crop, farmers: new Set(), area_ha: 0, expected_kg: 0, harvested_kg: 0, stages: { Planned: 0, Planted: 0, Growing: 0, 'Ready for Harvest': 0 },
    });
    row.farmers.add(c.user_id);
    row.area_ha += toHa(c.area_planted, c.area_unit);
    row.expected_kg += toKg(c.expected_production, c.expected_production_unit);
    row.stages[c.status] += 1;
  }
  const idSet = new Set(ids);
  for (const h of harvests) {
    if (!idSet.has(h.user_id) || !inRange(h.harvest_date || '')) continue;
    const name = (cropName[String(h.crop_id)] || '—').trim();
    const row = (crops[name.toLowerCase()] = crops[name.toLowerCase()] || {
      name, farmers: new Set(), area_ha: 0, expected_kg: 0, harvested_kg: 0, stages: { Planned: 0, Planted: 0, Growing: 0, 'Ready for Harvest': 0 },
    });
    row.harvested_kg += toKg(h.quantity, h.unit);
  }
  const cropRows = Object.values(crops)
    .map((c) => ({ name: c.name, farmers: c.farmers.size, area_ha: c.area_ha, expected_kg: c.expected_kg, harvested_kg: c.harvested_kg, stages: c.stages }))
    .sort((a, b) => b.area_ha - a.area_ha);
  const stages = { Planned: 0, Planted: 0, Growing: 0, 'Ready for Harvest': 0 };
  open.forEach((c) => { stages[c.status] += 1; });

  // activity: weekly trend for 12 weeks and the latest records
  const weeks = [];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 11 * 7); // Monday, 11 weeks back
  for (let i = 0; i < 12; i += 1) weeks.push({ week: iso(start.getTime() + i * 7 * DAY), count: 0 });
  const actMine = acts.filter((a) => idSet.has(a.user_id) && inRange(a.activity_date || ''));
  for (const a of actMine) {
    const t = new Date(a.activity_date).getTime();
    const idx = Math.floor((t - start.getTime()) / (7 * DAY));
    if (idx >= 0 && idx < 12) weeks[idx].count += 1;
  }
  const byType = {};
  actMine.forEach((a) => { byType[a.activity_type || 'Other'] = (byType[a.activity_type || 'Other'] || 0) + 1; });
  const activity = {
    weekly: weeks,
    by_type: Object.entries(byType).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    recent: actMine.slice(0, 10).map((a) => ({ farmer: nameOf(d.profileOf[a.user_id]), type: a.activity_type, date: a.activity_date, description: a.description || '' })),
  };

  // alerts
  const inactive = ids
    .filter((id) => !last[id] || new Date(last[id]).getTime() < activeSince)
    .map((id) => ({ farmer_id: id, farmer: nameOf(d.profileOf[id]), last_activity: last[id] || null }))
    .sort((a, b) => (a.last_activity ? new Date(a.last_activity).getTime() : 0) - (b.last_activity ? new Date(b.last_activity).getTime() : 0));
  const since14 = iso(now - 14 * DAY);
  const reports = [
    ...scouting.filter((s) => idSet.has(s.user_id) && (s.pest_observation || s.disease_observation) && (s.scouting_date || '') >= since14)
      .map((s) => ({ farmer: nameOf(d.profileOf[s.user_id]), crop: cropName[String(s.crop_id)] || '', kind: s.disease_observation ? 'Disease' : 'Pest', note: s.disease_observation || s.pest_observation, date: s.scouting_date })),
    ...protection.filter((p) => idSet.has(p.user_id) && (p.protection_date || '') >= since14 && ['High', 'Critical'].includes(p.severity))
      .map((p) => ({ farmer: nameOf(d.profileOf[p.user_id]), crop: '', kind: p.problem_type || 'Pest', note: p.problem_name, date: p.protection_date })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const overdue = open
    .filter((c) => c.expected_harvest_date && c.expected_harvest_date < today)
    .map((c) => ({ farmer: nameOf(d.profileOf[c.user_id]), crop: c.crop, due: c.expected_harvest_date, status: c.status }))
    .sort((a, b) => a.due.localeCompare(b.due));
  const alerts = {
    inactive_count: inactive.length, inactive: inactive.slice(0, 10),
    reports_count: reports.length, reports: reports.slice(0, 10),
    overdue_count: overdue.length, overdue: overdue.slice(0, 10),
  };

  const data = { generated_at: new Date().toISOString(), filters, overview, land, crops: cropRows, stages, activity, alerts };
  cache.set(key, { at: Date.now(), data });
  return data;
}

/* ---------------------------------------------------------------- farmer list */
export async function listFarmers(org, f, settings) {
  const d = await load(org, f);
  const last = await lastActivity(d.ids);
  const activeSince = Date.now() - settings.inactive_days * DAY;
  const farmsBy = {};
  d.farms.forEach((x) => { (farmsBy[x.user_id] = farmsBy[x.user_id] || []).push(x); });
  const cropsBy = {};
  d.cycles.filter((c) => OPEN.includes(c.status)).forEach((c) => { (cropsBy[c.user_id] = cropsBy[c.user_id] || new Set()).add(c.crop); });
  const joined = Object.fromEntries(d.links.map((l) => [l.farmer_id, l.joined_at]));

  let rows = d.ids.map((id) => {
    const farms = farmsBy[id] || [];
    return {
      farmer_id: id,
      name: nameOf(d.profileOf[id]),
      location: [...new Set(farms.map((x) => x.district).filter(Boolean))].join(', ') || d.profileOf[id]?.location || '',
      farms: farms.length,
      farm_ha: farms.reduce((s, x) => s + toHa(x.total_area, x.area_unit), 0),
      crops: [...(cropsBy[id] || [])],
      joined_at: joined[id],
      last_activity: last[id] || null,
      inactive: !last[id] || new Date(last[id]).getTime() < activeSince,
    };
  });
  if (f.q) {
    const q = f.q.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.location.toLowerCase().includes(q) || r.crops.some((c) => c.toLowerCase().includes(q)));
  }
  if (f.crop) rows = rows.filter((r) => r.crops.some((c) => c.toLowerCase() === f.crop.toLowerCase()));
  if (f.inactive === '1') rows = rows.filter((r) => r.inactive);
  if (f.joined_from) rows = rows.filter((r) => r.joined_at && iso(r.joined_at) >= f.joined_from);
  const sort = f.sort || 'name';
  const dir = f.order === 'desc' ? -1 : 1;
  rows.sort((a, b) => {
    const x = a[sort];
    const y = b[sort];
    if (typeof x === 'number' || typeof y === 'number') return (n(x) - n(y)) * dir;
    return String(x ?? '').localeCompare(String(y ?? '')) * dir;
  });
  return rows;
}
