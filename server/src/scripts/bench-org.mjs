/**
 * How long the organization dashboard and farmer list take with many farmers:
 *
 *   node src/scripts/bench-org.mjs [farmers=500]
 *
 * Creates an organization with N farmers (each with a farm, fields, crop cycles and some records) straight in the database, times the
 * dashboard and the farmer list cold (nothing cached) and warm, then removes everything. Needs no running server.
 */
import { connectDB } from '../config/db.js';
import * as M from '../models/index.js';
import { buildDashboard, listFarmers } from '../lib/orgs/dashboard.js';
import { ORG_DEFAULTS } from '../lib/orgs/core.js';

const N = Number(process.argv[2]) || 500;
const P = 'benchorg_';
await connectDB();
const re = new RegExp(`^${P}`);
const OWNED = [M.Farm, M.Field, M.Crop, M.CropCycle, M.FieldActivity, M.CropScoutingRecord, M.CropProtectionRecord, M.HarvestRecord, M.PlantingRecord, M.IrrigationRecord, M.FertilizerApplication];
const cleanup = async () => {
  const orgs = await M.Organization.find({ created_by: re }, '_id').lean();
  await Promise.all([
    M.Organization.deleteMany({ created_by: re }), M.FarmerOrganization.deleteMany({ organization_id: { $in: orgs.map((o) => o._id) } }),
    M.Profile.deleteMany({ user_id: re }), ...OWNED.map((Model) => Model.deleteMany({ user_id: re })),
  ]);
};
await cleanup();
const time = async (label, fn) => { const t0 = performance.now(); const out = await fn(); console.log(`${label.padEnd(34)} ${String(Math.round(performance.now() - t0)).padStart(6)} ms`); return out; };
const day = (o) => new Date(Date.now() + o * 86_400_000).toISOString().slice(0, 10);

try {
  const org = await M.Organization.create({ name: `${P}org`, name_key: `${P}org`, type: 'Cooperative', status: 'active', max_farmers: N + 10, farmer_count: N, created_by: `${P}x` });
  const ids = Array.from({ length: N }, (_, i) => `${P}f${i}`);
  await time(`seed ${N} farmers`, async () => {
    await M.Profile.insertMany(ids.map((id, i) => ({ user_id: id, full_name: `Farmer ${i}`, email: `${id}@bench.local`, account_status: 'active', is_active: true })), { ordered: false });
    await M.FarmerOrganization.insertMany(ids.map((id) => ({ farmer_id: id, organization_id: org._id, consent_given_at: new Date() })), { ordered: false });
    const crops = await M.Crop.insertMany(ids.map((id) => ({ user_id: id, name: 'Maize', category: 'Cereal' })));
    const farms = await M.Farm.insertMany(ids.map((id, i) => ({ user_id: id, name: `Farm ${i}`, district: `District ${i % 12}`, total_area: 1 + (i % 5), area_unit: 'hectares' })));
    const fields = await M.Field.insertMany(ids.flatMap((id, i) => [0, 1].map((k) => ({ user_id: id, farm_id: farms[i]._id, name: `Field ${k}`, area: 1, area_unit: 'hectares', latitude: -1.9 + (i % 50) / 100, longitude: 30 + (i % 50) / 100 }))));
    const cycles = await M.CropCycle.insertMany(ids.flatMap((id, i) => [0, 1].map((k) => ({ user_id: id, farm_id: farms[i]._id, field_id: fields[i * 2 + k]._id, crop_id: crops[i]._id, status: ['Planted', 'Growing', 'Ready for Harvest'][(i + k) % 3], area_planted: 1, expected_production: 1000, expected_harvest_date: day(((i + k) % 60) - 20) }))));
    const acts = ids.flatMap((id, i) => Array.from({ length: 30 }, (_, k) => ({ user_id: id, farm_id: farms[i]._id, crop_cycle_id: cycles[i * 2]._id, activity_type: ['Weeding', 'Planting', 'Spraying'][k % 3], activity_date: day(-k * 3) })));
    await M.FieldActivity.insertMany(acts, { ordered: false });
    await M.CropScoutingRecord.insertMany(ids.flatMap((id) => Array.from({ length: 6 }, (_, k) => ({ user_id: id, scouting_date: day(-k * 4), pest_observation: k % 2 ? 'aphids' : '', plant_health: 'Fair' }))), { ordered: false });
    await M.HarvestRecord.insertMany(ids.flatMap((id, i) => [0, 1, 2].map((k) => ({ user_id: id, crop_id: crops[i]._id, harvest_date: day(-30 - k * 40), quantity: 500, unit: 'kg' }))), { ordered: false });
  });
  const settings = ORG_DEFAULTS;
  const fresh = await M.Organization.findById(org._id);
  console.log(`\n-- ${N} farmers`);
  await time('dashboard, cold', () => buildDashboard(fresh, { from: '', to: '', district: '' }, settings, { fresh: true }));
  await time('dashboard, warm (cached)', () => buildDashboard(fresh, { from: '', to: '', district: '' }, settings));
  await time('dashboard, one district, cold', () => buildDashboard(fresh, { from: '', to: '', district: 'District 3' }, settings, { fresh: true }));
  await time('farmer list, cold', () => listFarmers(fresh, { district: '', q: '', crop: '', inactive: '', joined_from: '', sort: 'name', order: 'asc' }, settings));
  await time('farmer list, warm', () => listFarmers(fresh, { district: '', q: 'farmer 4', crop: '', inactive: '', joined_from: '', sort: 'name', order: 'asc' }, settings));
} finally {
  await cleanup();
  process.exit(0);
}
