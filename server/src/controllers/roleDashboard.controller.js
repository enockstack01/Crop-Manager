import { asyncHandler } from '../lib/asyncHandler.js';
import * as M from '../models/index.js';
import { AiUsage } from '../lib/ai/usage.js';

/*
 * What each kind of farm account sees first. Every account can still open every screen: the role decides what the home page puts in front of
 * the person (and which menu entries come first, see the apps), not what they are allowed to do.
 *
 *   Farmer               what needs attention on my farm this week
 *   Farm Manager         running the operation: harvests, work, stock, equipment, spending
 *   Agronomist           crop health: problems found, fields that need a visit, diagnoses
 *   Cooperative Manager  the same operation summary, plus the way to the organization tools
 *
 * Dates in the records are YYYY-MM-DD strings, so plain string comparison orders them.
 */
const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const OPEN = ['Planned', 'Planted', 'Growing', 'Ready for Harvest'];
const ROLES = ['Farmer', 'Farm Manager', 'Agronomist', 'Cooperative Manager'];

async function operations(uid, now) {
  const today = iso(now);
  const soon = iso(now + 14 * DAY);
  const weekAgo = iso(now - 7 * DAY);
  const monthStart = `${today.slice(0, 7)}-01`;
  const prev = new Date(now);
  prev.setUTCDate(1);
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  const prevStart = iso(prev.getTime());
  const [cycles, crops, items, equipment, maint, expenses, weekActs] = await Promise.all([
    M.CropCycle.find({ user_id: uid, status: { $in: OPEN } }, 'crop_id status expected_harvest_date').lean(),
    M.Crop.find({ user_id: uid }, 'name').lean(),
    M.InventoryItem.find({ user_id: uid }, 'name unit current_quantity minimum_stock expiry_date').lean(),
    M.Equipment.find({ user_id: uid }, 'name').lean(),
    M.EquipmentMaintenance.find({ user_id: uid, next_maintenance: { $ne: null } }, 'equipment_id next_maintenance maintenance_date').sort({ maintenance_date: -1 }).lean(),
    M.Expense.find({ user_id: uid, expense_date: { $gte: prevStart } }, 'amount expense_date').lean(),
    M.FieldActivity.find({ user_id: uid, activity_date: { $gte: weekAgo } }, 'total_cost').lean(),
  ]);
  const cropName = Object.fromEntries(crops.map((c) => [String(c._id), c.name]));
  const equipName = Object.fromEntries(equipment.map((e) => [String(e._id), e.name]));
  const row = (c) => ({ crop: cropName[String(c.crop_id)] || '—', status: c.status, due: c.expected_harvest_date });
  const overdue = cycles.filter((c) => c.expected_harvest_date && c.expected_harvest_date < today).map(row);
  const harvestSoon = cycles.filter((c) => c.expected_harvest_date && c.expected_harvest_date >= today && c.expected_harvest_date <= soon).map(row);
  const lowStock = items.filter((i) => (i.minimum_stock || 0) > 0 && (i.current_quantity || 0) <= i.minimum_stock).map((i) => ({ name: i.name, quantity: i.current_quantity || 0, minimum: i.minimum_stock, unit: i.unit }));
  const expiring = items.filter((i) => i.expiry_date && i.expiry_date <= iso(now + 30 * DAY)).map((i) => ({ name: i.name, expires: i.expiry_date }));
  const seen = new Set();
  const due = [];
  for (const m of maint) { // the newest record per machine says when its next service is due
    const k = String(m.equipment_id);
    if (seen.has(k)) continue;
    seen.add(k);
    if (m.next_maintenance <= soon) due.push({ name: equipName[k] || '—', due: m.next_maintenance, overdue: m.next_maintenance < today });
  }
  const sum = (rows) => Math.round(rows.reduce((s, e) => s + (e.amount || 0), 0));
  const thisMonth = sum(expenses.filter((e) => e.expense_date >= monthStart));
  const lastMonth = sum(expenses.filter((e) => e.expense_date < monthStart));
  return {
    stages: Object.fromEntries(OPEN.map((s) => [s, cycles.filter((c) => c.status === s).length])),
    overdue_harvests: overdue.slice(0, 8), overdue_count: overdue.length,
    harvest_soon: harvestSoon.slice(0, 8), harvest_soon_count: harvestSoon.length,
    low_stock: lowStock.slice(0, 8), low_stock_count: lowStock.length,
    expiring: expiring.slice(0, 8), expiring_count: expiring.length,
    maintenance_due: due.slice(0, 8), maintenance_due_count: due.length,
    spending: { this_month: thisMonth, last_month: lastMonth },
    work_this_week: { activities: weekActs.length, cost: Math.round(weekActs.reduce((s, a) => s + (a.total_cost || 0), 0)) },
  };
}

async function cropHealth(uid, now) {
  const today = iso(now);
  const since14 = iso(now - 14 * DAY);
  const since30 = iso(now - 30 * DAY);
  const [scouting, protection, cycles, crops, diagnoses] = await Promise.all([
    M.CropScoutingRecord.find({ user_id: uid, scouting_date: { $gte: since30 } }, 'scouting_date plant_health pest_observation disease_observation crop_cycle_id crop_id').sort({ scouting_date: -1 }).lean(),
    M.CropProtectionRecord.find({ user_id: uid, protection_date: { $gte: since30 } }, 'protection_date problem_type problem_name severity').sort({ protection_date: -1 }).lean(),
    M.CropCycle.find({ user_id: uid, status: { $in: ['Planted', 'Growing', 'Ready for Harvest'] } }, 'crop_id field_id status').lean(),
    M.Crop.find({ user_id: uid }, 'name').lean(),
    AiUsage.countDocuments({ user_id: uid, feature: 'diagnose', ok: true, day: { $gte: since30 } }),
  ]);
  const cropName = Object.fromEntries(crops.map((c) => [String(c._id), c.name]));
  const problems = scouting
    .filter((s) => s.pest_observation || s.disease_observation || (s.plant_health && s.plant_health !== 'Healthy'))
    .map((s) => ({ date: s.scouting_date, crop: cropName[String(s.crop_id)] || '', kind: s.disease_observation ? 'Disease' : s.pest_observation ? 'Pest' : 'Plant health', note: s.disease_observation || s.pest_observation || s.plant_health }));
  const serious = protection.filter((p) => ['High', 'Critical'].includes(p.severity)).map((p) => ({ date: p.protection_date, type: p.problem_type, name: p.problem_name, severity: p.severity }));
  const scouted = new Set(scouting.filter((s) => s.scouting_date >= since14).map((s) => String(s.crop_cycle_id)));
  const needVisit = cycles.filter((c) => !scouted.has(String(c._id))).map((c) => ({ crop: cropName[String(c.crop_id)] || '—', status: c.status }));
  return {
    problems_found: problems.slice(0, 8), problems_count: problems.length,
    serious_issues: serious.slice(0, 8), serious_count: serious.length,
    needs_visit: needVisit.slice(0, 8), needs_visit_count: needVisit.length,
    healthy_visits: scouting.filter((s) => !s.pest_observation && !s.disease_observation && (!s.plant_health || s.plant_health === 'Healthy')).length,
    diagnoses_30d: diagnoses,
    today,
  };
}

// GET /api/dashboard/role
export const getRoleDashboard = asyncHandler(async (req, res) => {
  const role = ROLES.includes(req.profile?.role) ? req.profile.role : 'Farmer';
  const uid = req.userId;
  const now = Date.now();
  const out = { role };
  if (role === 'Agronomist') {
    out.crop_health = await cropHealth(uid, now);
    out.operations = await operations(uid, now);
  } else {
    out.operations = await operations(uid, now);
    if (role === 'Cooperative Manager') {
      // the cooperative's own tools are a separate organization account; say whether this person already has one
      const member = await M.OrganizationMember.exists({ user_id: uid, status: 'active' });
      out.organization = { has_workspace: !!member, register_path: '/organization/register' };
    }
  }
  res.json(out);
});
