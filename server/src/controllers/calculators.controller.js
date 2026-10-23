import { asyncHandler } from '../lib/asyncHandler.js';
import { Farm, Field } from '../models/index.js';
import { openCycles, weatherForUser } from '../lib/weather.js';

const toHa = (area, unit) => {
  const a = Number(area);
  if (!Number.isFinite(a) || a <= 0) return null;
  const u = String(unit || 'hectares').toLowerCase();
  if (u.startsWith('acre')) return a * 0.404686;
  if (u.includes('m') && !u.startsWith('h')) return a / 10000;
  return a;
};
const r4 = (n) => (n === null ? null : Math.round(n * 10000) / 10000);

/** GET /api/calculators/context  The farmer's fields (area in hectares, crop now growing, soil) and the water plan, to prefill the calculators. */
export const calculatorContext = asyncHandler(async (req, res) => {
  const [farms, fields, cycles] = await Promise.all([Farm.find({ user_id: req.userId }).lean(), Field.find({ user_id: req.userId }).lean(), openCycles(req.userId)]);
  const farmName = (id) => farms.find((f) => String(f._id) === String(id))?.name || '';
  let water = null;
  try {
    const w = await weatherForUser(req.userId, {});
    if (w.located) water = { ...w.water, location: w.location.name, rain_next_3_days_mm: Math.round(w.daily.slice(0, 3).reduce((a, d) => a + (d.rain_mm || 0), 0) * 10) / 10 };
  } catch { /* weather is optional */ }
  res.json({
    fields: fields.map((f) => ({
      id: String(f._id), name: f.name, farm: farmName(f.farm_id), area_ha: r4(toHa(f.area, f.area_unit)), soil: f.soil_type || null, soil_ph: f.soil_ph ?? null,
      crop: cycles.find((c) => c.field_name === f.name)?.crop_name || null,
    })),
    water,
  });
});
