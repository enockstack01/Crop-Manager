import * as M from '../../models/index.js';

/**
 * Compact, current snapshot of one farmer's data for the model. Only this user's rows are read
 * (every query is scoped by user_id), and only the fields an agronomist would use.
 */

const LANGUAGES = { en: 'English', fr: 'French', rw: 'Kinyarwanda', sw: 'Swahili' };
export const languageName = (code) => LANGUAGES[code] || 'English';

const OPEN_STATUSES = new Set(['Planned', 'Planted', 'Growing', 'Ready for Harvest']);
const round = (n, d = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : null);
const todayStr = () => new Date().toISOString().slice(0, 10);
const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
};

export async function buildFarmContext(userId, profile = {}) {
  const q = { user_id: userId };
  const [farms, fields, crops, cycles, scouting, protection, inventory, expenses, sales, harvests, seasons] = await Promise.all([
    M.Farm.find(q).lean(),
    M.Field.find(q).lean(),
    M.Crop.find(q).lean(),
    M.CropCycle.find(q).sort({ planting_date: -1 }).limit(60).lean(),
    M.CropScoutingRecord.find(q).sort({ scouting_date: -1 }).limit(12).lean(),
    M.CropProtectionRecord.find(q).sort({ protection_date: -1 }).limit(10).lean(),
    M.InventoryItem.find(q).lean(),
    M.Expense.find({ ...q, expense_date: { $gte: monthsAgo(12) } }).lean(),
    M.Sale.find({ ...q, sale_date: { $gte: monthsAgo(12) } }).lean(),
    M.HarvestRecord.find({ ...q, harvest_date: { $gte: monthsAgo(12) } }).lean(),
    M.Season.find(q).lean(),
  ]);

  const name = (list, id) => list.find((x) => String(x._id) === String(id))?.name || null;
  const money = (rows, key, amountKey) => {
    const out = {};
    for (const r of rows) {
      const cur = r.currency || profile.currency || 'USD';
      out[cur] = out[cur] || { total: 0, by: {} };
      const v = Number(r[amountKey]) || 0;
      out[cur].total += v;
      const k = r[key] || 'Other';
      out[cur].by[k] = (out[cur].by[k] || 0) + v;
    }
    for (const cur of Object.keys(out)) {
      out[cur].total = round(out[cur].total, 0);
      out[cur].by = Object.fromEntries(Object.entries(out[cur].by).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => [k, round(v, 0)]));
    }
    return out;
  };

  const harvestByCrop = {};
  for (const h of harvests) {
    const c = name(crops, h.crop_id) || 'Unknown';
    harvestByCrop[c] = harvestByCrop[c] || { quantity: 0, unit: h.unit || 'kg' };
    harvestByCrop[c].quantity += Number(h.quantity) || 0;
  }

  const ctx = {
    today: todayStr(),
    owner: {
      country: profile.access_request?.country || farms[0]?.country || null,
      main_crops: profile.access_request?.main_crops || null,
      account_type: profile.role,
      currency: profile.currency || 'USD',
    },
    farms: farms.map((f) => ({
      name: f.name, location: [f.location, f.district, f.province, f.country].filter(Boolean).join(', '),
      area: f.total_area ? `${f.total_area} ${f.area_unit}` : null,
    })),
    fields: fields.slice(0, 40).map((f) => ({
      name: f.name, farm: name(farms, f.farm_id), area: f.area ? `${f.area} ${f.area_unit}` : null,
      soil: f.soil_type || null, soil_ph: f.soil_ph ?? null, status: f.status,
    })),
    seasons: seasons.map((s) => ({ name: s.name, status: s.status, start: s.start_date, end: s.end_date })),
    crop_cycles: cycles.slice(0, 30).map((c) => ({
      crop: name(crops, c.crop_id), field: name(fields, c.field_id), farm: name(farms, c.farm_id), season: name(seasons, c.season_id),
      status: c.status, planted: c.planting_date, expected_harvest: c.expected_harvest_date, harvested: c.actual_harvest_date,
      area: c.area_planted ? `${c.area_planted} ${c.area_unit}` : null,
      expected_production: c.expected_production ? `${c.expected_production} ${c.expected_production_unit}` : null,
      actual_production: c.actual_production ? `${c.actual_production} ${c.actual_production_unit}` : null,
      open: OPEN_STATUSES.has(c.status),
    })),
    recent_scouting: scouting.map((s) => ({
      date: s.scouting_date, crop: name(crops, s.crop_id), field: name(fields, s.field_id), stage: s.growth_stage, health: s.plant_health,
      pests: s.pest_observation || null, disease: s.disease_observation || null, weeds: s.weed_observation || null, recommendation: s.recommendation || null,
    })),
    recent_crop_protection: protection.map((p) => ({
      date: p.protection_date, problem: p.problem_name, type: p.problem_type, severity: p.severity, treatment: p.treatment, product: p.product_name,
    })),
    inventory: inventory.slice(0, 40).map((i) => ({
      name: i.name, category: i.category, quantity: `${i.current_quantity} ${i.unit}`, minimum: i.minimum_stock, expires: i.expiry_date || null,
      low: i.current_quantity <= i.minimum_stock,
    })),
    last_12_months: {
      expenses: money(expenses, 'category', 'amount'),
      sales: money(sales, 'payment_status', 'total_amount'),
      harvest_by_crop: harvestByCrop,
    },
  };
  return { ctx, lists: { farms, fields, crops, cycles } };
}

/** The JSON the model sees, as one text block. */
export const contextText = (ctx) => `FARM DATA (read only, today is ${ctx.today})\n${JSON.stringify(ctx)}`;
