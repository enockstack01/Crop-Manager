import { asyncHandler } from '../lib/asyncHandler.js';
import { resources } from '../resources.js';
import { recordLoader } from '../lib/records.js';
import { Crop, Farm, Field } from '../models/index.js';

/*
 * Search across a farmer's own records: names, notes and descriptions, plus anything recorded against a
 * farm, field or crop whose name matches. Results are grouped by kind with the page they open.
 */
const ROUTE = {
  farms: '/farms', fields: '/fields', crops: '/crops', 'crop-varieties': '/varieties', seasons: '/seasons', 'crop-cycles': '/crop-cycles',
  'planting-records': '/planting', 'field-activities': '/activities', 'irrigation-records': '/irrigation', 'fertilizer-applications': '/fertilizers',
  'crop-protection-records': '/crop-protection', 'crop-scouting-records': '/scouting', 'harvest-records': '/harvest',
  'inventory-items': '/inventory', equipment: '/equipment', 'equipment-maintenance': '/maintenance', expenses: '/expenses', sales: '/sales',
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const first = (...v) => v.find((x) => x !== undefined && x !== null && String(x).trim() !== '');

/** A short title for a record of any kind. */
function titleOf(r) {
  return String(first(
    r.name, r.problem_name, r.fertilizer_name, r.description, r.category,
    r.crops?.name && `${r.crops.name}${r.growth_stage ? ` · ${r.growth_stage}` : ''}`, r.buyer, r.notes && String(r.notes).slice(0, 60), 'Record',
  ));
}
function subtitleOf(r) {
  const date = first(r.planting_date, r.activity_date, r.irrigation_date, r.application_date, r.protection_date, r.scouting_date, r.harvest_date, r.expense_date, r.sale_date, r.expected_harvest_date, r.service_date);
  return [r.farms?.name, r.fields?.name, r.crops?.name && r.crops.name !== titleOf(r) ? r.crops.name : '', date].filter(Boolean).join(' · ');
}

export const search = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q.length < 2) return res.json({ q, groups: [] });
  const rx = new RegExp(esc(q), 'i');
  const uid = req.userId;

  // things whose own name matches: records kept against them match too
  const [farms, fields, crops] = await Promise.all([
    Farm.find({ user_id: uid, name: rx }, '_id').limit(20).lean(),
    Field.find({ user_id: uid, name: rx }, '_id').limit(20).lean(),
    Crop.find({ user_id: uid, name: rx }, '_id').limit(20).lean(),
  ]);
  const links = { farm_id: farms.map((x) => x._id), field_id: fields.map((x) => x._id), crop_id: crops.map((x) => x._id) };

  const groups = (await Promise.all(Object.keys(ROUTE).map(async (path) => {
    const r = resources.find((x) => x.path === path);
    if (!r) return null;
    const or = (r.search || []).map((f) => ({ [f]: rx }));
    const schema = r.model.schema.paths;
    for (const [field, ids] of Object.entries(links)) if (ids.length && schema[field]) or.push({ [field]: { $in: ids } });
    if (!or.length) return null;
    const rows = await recordLoader(path, { filter: { $or: or }, sort: { created_at: -1 }, limit: 5 })(uid);
    if (!rows.length) return null;
    return {
      kind: path,
      label: r.name,
      route: ROUTE[path],
      items: rows.map((row) => ({ id: row.id, title: titleOf(row), subtitle: subtitleOf(row) })),
    };
  }))).filter(Boolean);

  res.json({ q, groups });
});
