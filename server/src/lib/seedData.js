/**
 * Seed one user's data. Assumes an active Mongo connection.
 * Wipes the user's existing rows, then inserts a realistic Zambia-context dataset.
 */
import * as M from '../models/index.js';

const iso = (d) => d.toISOString().slice(0, 10);
const TODAY = iso(new Date());
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const daysAhead = (n) => daysAgo(-n);
const monthStart = (mAgo) => { const d = new Date(); d.setDate(15); d.setMonth(d.getMonth() - mAgo); const s = iso(d); return s > TODAY ? daysAgo(3) : s; };
const pick = (arr, i) => arr[i % arr.length];
const rand = (min, max) => Math.round(min + Math.random() * (max - min));

export const OWNED_MODELS = [
  M.Farm, M.Field, M.Crop, M.CropVariety, M.Season, M.CropCycle, M.PlantingRecord,
  M.FieldActivity, M.IrrigationRecord, M.FertilizerApplication, M.CropProtectionRecord,
  M.CropScoutingRecord, M.HarvestRecord, M.InventoryItem, M.InventoryTransaction,
  M.Equipment, M.EquipmentMaintenance, M.Expense, M.Sale, M.Notification, M.CalculationHistory,
];

export async function clearUser(userId) {
  const results = await Promise.all(OWNED_MODELS.map((Model) => Model.deleteMany({ user_id: userId })));
  return results.reduce((n, r) => n + (r.deletedCount || 0), 0);
}

export async function seedUser(userId, opts = {}) {
  const {
    profile = {},
    farmA = { name: 'Green Valley Estate', code: 'GVE' },
    farmB = { name: 'Kafue Riverside Farm', code: 'KRF' },
  } = opts;

  await clearUser(userId);

  const U = { user_id: userId };
  const many = (Model, docs) => Model.insertMany(docs.map((doc) => ({ ...U, ...doc })));

  await M.Profile.findOneAndUpdate(
    { user_id: userId },
    {
      $set: {
        full_name: profile.full_name || 'Farm Operator',
        role: profile.role || 'Farm Manager',
        location: profile.location || 'Lusaka, Zambia',
        phone: profile.phone || '+260 977 000 000',
        onboarded: true,
      },
    },
    { upsert: true }
  );

  const [gve, krf] = await many(M.Farm, [
    { name: farmA.name, code: `${farmA.code}-01`, location: 'Chongwe District', district: 'Chongwe', province: 'Lusaka Province', country: 'Zambia', total_area: 180, area_unit: 'hectares', farm_type: 'Mixed', description: 'Rain-fed and irrigated block farm east of Lusaka.' },
    { name: farmB.name, code: `${farmB.code}-02`, location: 'Kafue District', district: 'Kafue', province: 'Lusaka Province', country: 'Zambia', total_area: 95, area_unit: 'hectares', farm_type: 'Irrigated', description: 'Irrigated horticulture and grain along the Kafue river.' },
  ]);

  const fields = await many(M.Field, [
    { farm_id: gve._id, name: 'North Block', code: `${farmA.code}-NB`, area: 45, area_unit: 'hectares', soil_type: 'Clay loam', soil_ph: 6.2, status: 'Active' },
    { farm_id: gve._id, name: 'South Block', code: `${farmA.code}-SB`, area: 60, area_unit: 'hectares', soil_type: 'Sandy loam', soil_ph: 5.8, status: 'Active' },
    { farm_id: gve._id, name: 'East Block', code: `${farmA.code}-EB`, area: 30, area_unit: 'hectares', soil_type: 'Sandy clay', soil_ph: 6.0, status: 'Fallow' },
    { farm_id: krf._id, name: 'River Field', code: `${farmB.code}-RF`, area: 40, area_unit: 'hectares', soil_type: 'Alluvial', soil_ph: 6.6, status: 'Active' },
    { farm_id: krf._id, name: 'Hill Field', code: `${farmB.code}-HF`, area: 25, area_unit: 'hectares', soil_type: 'Loam', soil_ph: 6.3, status: 'Active' },
    { farm_id: krf._id, name: 'Back Field', code: `${farmB.code}-BF`, area: 20, area_unit: 'hectares', soil_type: 'Sandy loam', soil_ph: 5.9, status: 'Preparing' },
  ]);
  const F = { 'GVE-NB': fields[0], 'GVE-SB': fields[1], 'GVE-EB': fields[2], 'KRF-RF': fields[3], 'KRF-HF': fields[4], 'KRF-BF': fields[5] };

  const crops = await many(M.Crop, [
    { name: 'Maize', category: 'Cereal', typical_growing_period: 140, growing_period_unit: 'days', description: 'Staple grain crop.' },
    { name: 'Soybean', category: 'Legume', typical_growing_period: 120, growing_period_unit: 'days' },
    { name: 'Wheat', category: 'Cereal', typical_growing_period: 110, growing_period_unit: 'days' },
    { name: 'Groundnut', category: 'Legume', typical_growing_period: 130, growing_period_unit: 'days' },
    { name: 'Sunflower', category: 'Oilseed', typical_growing_period: 100, growing_period_unit: 'days' },
    { name: 'Cotton', category: 'Fibre', typical_growing_period: 170, growing_period_unit: 'days' },
    { name: 'Tomato', category: 'Vegetable', typical_growing_period: 90, growing_period_unit: 'days' },
    { name: 'Onion', category: 'Vegetable', typical_growing_period: 120, growing_period_unit: 'days' },
  ]);
  const C = Object.fromEntries(crops.map((c) => [c.name, c]));

  const varieties = await many(M.CropVariety, [
    { crop_id: C.Maize._id, name: 'SC 627', maturity_period: 140, maturity_period_unit: 'days', seed_source: 'SeedCo' },
    { crop_id: C.Maize._id, name: 'PAN 53', maturity_period: 135, maturity_period_unit: 'days', seed_source: 'Pannar' },
    { crop_id: C.Soybean._id, name: 'Dina', maturity_period: 120, maturity_period_unit: 'days', seed_source: 'ZamSeed' },
    { crop_id: C.Soybean._id, name: 'Safari', maturity_period: 118, maturity_period_unit: 'days', seed_source: 'SeedCo' },
    { crop_id: C.Wheat._id, name: 'Loerie', maturity_period: 110, maturity_period_unit: 'days', seed_source: 'ZamSeed' },
    { crop_id: C.Groundnut._id, name: 'MGV 4', maturity_period: 130, maturity_period_unit: 'days', seed_source: 'GART' },
    { crop_id: C.Sunflower._id, name: 'Pannar 7351', maturity_period: 100, maturity_period_unit: 'days', seed_source: 'Pannar' },
    { crop_id: C.Cotton._id, name: 'Chureza', maturity_period: 170, maturity_period_unit: 'days', seed_source: 'Quton' },
    { crop_id: C.Tomato._id, name: 'Rodade', maturity_period: 90, maturity_period_unit: 'days', seed_source: 'Starke Ayres' },
    { crop_id: C.Onion._id, name: 'Red Creole', maturity_period: 120, maturity_period_unit: 'days', seed_source: 'Starke Ayres' },
  ]);
  const V = Object.fromEntries(varieties.map((v) => [v.name, v]));

  const seasons = await many(M.Season, [
    { name: '2024/2025 Rainy', start_date: '2024-11-01', end_date: '2025-05-31', status: 'Completed', description: 'Main rain-fed cropping season.' },
    { name: '2025 Winter (Dry)', start_date: '2025-05-01', end_date: '2025-09-30', status: 'Active', description: 'Irrigated winter cropping.' },
    { name: '2025/2026 Rainy', start_date: '2025-11-01', end_date: '2026-05-31', status: 'Active', description: 'Current main season.' },
  ]);
  const S = Object.fromEntries(seasons.map((s) => [s.name, s]));

  const cycleSpec = [
    ['GVE-NB', 'Maize', 'SC 627', '2025/2026 Rainy', 'Growing', 200, 45, true, -70, 70],
    ['GVE-SB', 'Soybean', 'Dina', '2025/2026 Rainy', 'Growing', 165, 60, true, -60, 60],
    ['KRF-RF', 'Wheat', 'Loerie', '2025 Winter (Dry)', 'Ready for Harvest', 190, 40, true, -100, 5],
    ['KRF-HF', 'Tomato', 'Rodade', '2025 Winter (Dry)', 'Harvested', 0, 12, true, -120, -20],
    ['KRF-HF', 'Onion', 'Red Creole', '2025 Winter (Dry)', 'Growing', 90, 10, true, -55, 65],
    ['GVE-NB', 'Maize', 'PAN 53', '2024/2025 Rainy', 'Completed', 0, 42, true, -300, -150],
    ['GVE-SB', 'Sunflower', 'Pannar 7351', '2024/2025 Rainy', 'Completed', 0, 55, true, -290, -170],
    ['KRF-RF', 'Groundnut', 'MGV 4', '2024/2025 Rainy', 'Completed', 0, 35, true, -280, -150],
    ['GVE-EB', 'Cotton', 'Chureza', '2024/2025 Rainy', 'Harvested', 0, 28, true, -270, -100],
    ['KRF-BF', 'Maize', 'SC 627', '2025/2026 Rainy', 'Planned', 130, 18, false, 20, 160],
    ['GVE-SB', 'Wheat', 'Loerie', '2025 Winter (Dry)', 'Cancelled', 0, 15, true, -110, 0],
    ['KRF-RF', 'Soybean', 'Safari', '2025/2026 Rainy', 'Planted', 150, 38, true, -20, 100],
  ];
  const cycles = await many(
    M.CropCycle,
    cycleSpec.map(([fc, cn, vn, sn, status, expProd, area, planted, plantOff, harvOff]) => {
      const field = F[fc];
      const done = ['Harvested', 'Completed'].includes(status);
      return {
        farm_id: field.farm_id, field_id: field._id, crop_id: C[cn]._id, variety_id: V[vn]._id, season_id: S[sn]._id,
        planting_date: planted ? daysAgo(-plantOff) : null,
        expected_harvest_date: daysAgo(-harvOff),
        actual_harvest_date: done ? daysAgo(-harvOff) : null,
        area_planted: area, area_unit: 'hectares',
        seed_quantity: Math.round(area * (cn === 'Maize' ? 25 : cn === 'Soybean' ? 80 : 20)), seed_unit: 'kg',
        expected_production: expProd ? Math.round(area * expProd) : Math.round(area * rand(2500, 4000)),
        expected_production_unit: 'kg',
        actual_production: done ? Math.round(area * rand(1800, 4200)) : null, actual_production_unit: 'kg',
        status,
      };
    })
  );

  await many(
    M.PlantingRecord,
    cycles.filter((c) => c.planting_date).slice(0, 8).map((c) => ({
      crop_cycle_id: c._id, farm_id: c.farm_id, field_id: c.field_id,
      planting_date: c.planting_date, seed_quantity: c.seed_quantity, seed_unit: 'kg',
      seed_source: 'SeedCo', seed_cost: rand(1500, 9000),
      row_spacing: 75, plant_spacing: 25, spacing_unit: 'cm', planting_method: 'Mechanised row planting',
    }))
  );

  const actTypes = ['Land Preparation', 'Planting', 'Weeding', 'Fertilization', 'Spraying', 'Scouting', 'Irrigation', 'Harvest', 'Transport', 'Machinery'];
  await many(M.FieldActivity, Array.from({ length: 22 }).map((_, i) => {
    const c = pick(cycles, i);
    return {
      farm_id: c.farm_id, field_id: c.field_id, crop_cycle_id: c._id,
      activity_type: pick(actTypes, i), activity_date: daysAgo(rand(2, 230)),
      description: `${pick(actTypes, i)} on ${pick(cycleSpec, i)[1]}`,
      labor_cost: rand(200, 2500), equipment_cost: rand(0, 1800), material_cost: rand(0, 3000),
      performed_by: pick(['Field team A', 'Field team B', 'Contractor', 'Agronomist'], i),
    };
  }));

  await many(M.IrrigationRecord, Array.from({ length: 10 }).map((_, i) => {
    const c = pick(cycles.filter((x) => x.status !== 'Planned'), i);
    return {
      farm_id: c.farm_id, field_id: c.field_id, crop_cycle_id: c._id,
      irrigation_date: daysAgo(rand(3, 150)),
      irrigation_method: pick(['Drip', 'Sprinkler', 'Furrow', 'Center Pivot'], i),
      duration_hours: rand(2, 10), water_volume: rand(200, 1800), water_unit: 'cubic metres',
      area_irrigated: rand(5, 40), area_unit: 'hectares', cost: rand(300, 2600),
      operator: pick(['Pump operator', 'Irrigation team'], i),
    };
  }));

  await many(M.FertilizerApplication, Array.from({ length: 12 }).map((_, i) => {
    const c = pick(cycles, i);
    return {
      farm_id: c.farm_id, field_id: c.field_id, crop_cycle_id: c._id,
      application_date: daysAgo(rand(5, 220)),
      fertilizer_name: pick(['Compound D', 'Urea', 'Top Dressing D', 'Foliar Blend', 'Lime'], i),
      fertilizer_type: pick(['NPK', 'Urea', 'DAP', 'Foliar', 'Lime'], i),
      quantity: rand(200, 5000), unit: 'kg',
      application_method: pick(['Broadcasting', 'Band Placement', 'Top Dressing', 'Fertigation'], i),
      cost: rand(2000, 28000), supplier: pick(['Omnia', 'ETG', 'Nyiombo'], i), applied_by: 'Field team',
    };
  }));

  await many(M.CropProtectionRecord, Array.from({ length: 8 }).map((_, i) => {
    const c = pick(cycles, i);
    return {
      farm_id: c.farm_id, field_id: c.field_id, crop_cycle_id: c._id,
      protection_date: daysAgo(rand(4, 180)),
      problem_type: pick(['Pest', 'Disease', 'Weed', 'Pest'], i),
      problem_name: pick(['Fall armyworm', 'Grey leaf spot', 'Broadleaf weeds', 'Aphids', 'Rust'], i),
      severity: pick(['Low', 'Moderate', 'High', 'Moderate'], i),
      treatment: pick(['Emamectin benzoate', 'Mancozeb', 'Glyphosate', 'Imidacloprid'], i),
      product_name: pick(['Belt', 'Dithane', 'Roundup', 'Confidor'], i),
      quantity: rand(1, 20), unit: 'litres', application_method: 'Spraying', cost: rand(800, 9000), applied_by: 'Spray team',
    };
  }));

  const health = ['Healthy', 'Healthy', 'Under Observation', 'At Risk', 'Healthy', 'Under Observation'];
  await many(M.CropScoutingRecord, Array.from({ length: 12 }).map((_, i) => {
    const c = pick(cycles.filter((x) => x.status !== 'Planned' && x.status !== 'Cancelled'), i);
    const h = pick(health, i);
    return {
      farm_id: c.farm_id, field_id: c.field_id, crop_id: c.crop_id, crop_cycle_id: c._id,
      scouting_date: daysAgo(rand(1, 120)),
      scout_name: pick(['J. Banda', 'M. Phiri', 'Agronomist'], i),
      growth_stage: pick(['Vegetative', 'Flowering', 'Grain fill', 'Seedling'], i),
      plant_health: h,
      pest_observation: h === 'Healthy' ? '' : pick(['Light armyworm damage on 5% of plants', 'Aphid colonies on field edge'], i),
      disease_observation: h === 'At Risk' ? 'Early leaf spot spreading in low-lying area' : '',
      weed_observation: i % 3 === 0 ? 'Moderate broadleaf pressure between rows' : '',
      moisture_observation: pick(['Adequate', 'Slightly dry topsoil', 'Good'], i),
      recommendation: h === 'Healthy' ? 'Continue monitoring weekly' : 'Schedule targeted spray within 3 days',
    };
  }));

  const harvestSpec = [
    ['Maize', 'GVE-NB', 13], ['Sunflower', 'GVE-SB', 12], ['Groundnut', 'KRF-RF', 11], ['Cotton', 'GVE-EB', 10],
    ['Maize', 'GVE-NB', 9], ['Tomato', 'KRF-HF', 8], ['Tomato', 'KRF-HF', 7], ['Tomato', 'KRF-HF', 6],
    ['Wheat', 'KRF-RF', 4], ['Onion', 'KRF-HF', 3], ['Maize', 'GVE-SB', 3], ['Soybean', 'GVE-SB', 2],
    ['Tomato', 'KRF-HF', 2], ['Maize', 'GVE-NB', 1], ['Groundnut', 'KRF-RF', 1],
  ];
  await many(M.HarvestRecord, harvestSpec.map(([cn, fc, mAgo], i) => {
    const field = F[fc];
    const area = rand(8, 45);
    const perHa = cn === 'Tomato' ? rand(18000, 32000) : cn === 'Onion' ? rand(15000, 25000) : rand(1600, 4200);
    return {
      farm_id: field.farm_id, field_id: field._id, crop_id: C[cn]._id,
      harvest_date: monthStart(mAgo), harvested_area: area, area_unit: 'hectares',
      quantity: area * perHa, unit: 'kg',
      grade: pick(['A', 'B', 'A', 'Premium'], i), quality: pick(['Excellent', 'Good', 'Average', 'Good'], i),
      storage_location: pick(['Main shed', 'Silo 1', 'Cold room', 'Grain bags'], i),
      labor_cost: rand(1500, 9000), transport_cost: rand(800, 6000), other_costs: rand(0, 2500),
    };
  }));

  const inv = await many(M.InventoryItem, [
    { name: 'Maize seed SC 627', category: 'Seeds', unit: 'kg', current_quantity: 350, minimum_stock: 150, unit_cost: 85, supplier: 'SeedCo', storage_location: 'Main shed', expiry_date: daysAhead(220) },
    { name: 'Compound D fertilizer', category: 'Fertilizers', unit: 'bags', current_quantity: 40, minimum_stock: 30, unit_cost: 750, supplier: 'Nyiombo', storage_location: 'Fertilizer store' },
    { name: 'Urea', category: 'Fertilizers', unit: 'bags', current_quantity: 12, minimum_stock: 25, unit_cost: 820, supplier: 'Omnia', storage_location: 'Fertilizer store' },
    { name: 'Glyphosate 480', category: 'Pesticides', unit: 'litres', current_quantity: 8, minimum_stock: 20, unit_cost: 190, supplier: 'ETG', storage_location: 'Chemical store', expiry_date: daysAhead(18) },
    { name: 'Emamectin benzoate', category: 'Pesticides', unit: 'litres', current_quantity: 0, minimum_stock: 5, unit_cost: 430, supplier: 'ETG', storage_location: 'Chemical store' },
    { name: 'Knapsack sprayers', category: 'Tools', unit: 'units', current_quantity: 6, minimum_stock: 4, unit_cost: 650, supplier: 'Agrico', storage_location: 'Workshop' },
    { name: 'Grain bags (50kg)', category: 'Packaging', unit: 'units', current_quantity: 1800, minimum_stock: 500, unit_cost: 9, supplier: 'Local', storage_location: 'Main shed' },
    { name: 'Diesel', category: 'Other', unit: 'litres', current_quantity: 320, minimum_stock: 400, unit_cost: 32, supplier: 'Puma', storage_location: 'Fuel bay' },
    { name: 'Tomato seed Rodade', category: 'Seeds', unit: 'packets', current_quantity: 3, minimum_stock: 6, unit_cost: 240, supplier: 'Starke Ayres', storage_location: 'Cold room', expiry_date: daysAhead(60) },
    { name: 'Lime', category: 'Fertilizers', unit: 'tonnes', current_quantity: 5, minimum_stock: 2, unit_cost: 900, supplier: 'Ndola Lime', storage_location: 'Yard' },
    { name: 'Mancozeb 80 WP', category: 'Pesticides', unit: 'kg', current_quantity: 25, minimum_stock: 10, unit_cost: 120, supplier: 'ETG', storage_location: 'Chemical store', expiry_date: daysAhead(400) },
  ]);
  await many(M.InventoryTransaction, [
    { item_id: inv[0]._id, transaction_type: 'Stock In', quantity: 500, previous_quantity: 0, new_quantity: 500, notes: 'Season purchase' },
    { item_id: inv[0]._id, transaction_type: 'Stock Out', quantity: 150, previous_quantity: 500, new_quantity: 350, notes: 'Issued to North Block' },
    { item_id: inv[3]._id, transaction_type: 'Stock Out', quantity: 12, previous_quantity: 20, new_quantity: 8, notes: 'Weed control' },
  ]);

  const eq = await many(M.Equipment, [
    { name: 'John Deere 5075E', equipment_type: 'Tractor', model: '5075E', serial_number: 'JD5075-2291', purchase_date: '2022-03-14', purchase_cost: 850000, condition: 'Good', location: farmA.name, status: 'Available' },
    { name: 'Massey Ferguson 385', equipment_type: 'Tractor', model: 'MF 385', serial_number: 'MF385-7741', purchase_date: '2019-08-02', purchase_cost: 520000, condition: 'Fair', location: farmB.name, status: 'Maintenance' },
    { name: 'Boom sprayer 600L', equipment_type: 'Sprayer', model: 'Hardi 600', serial_number: 'HD600-1180', purchase_date: '2021-06-20', purchase_cost: 95000, condition: 'Good', location: farmA.name, status: 'In Use' },
    { name: '4-row planter', equipment_type: 'Planter', model: 'Piket 4R', serial_number: 'PK4R-3320', purchase_date: '2020-10-11', purchase_cost: 140000, condition: 'Good', location: farmA.name, status: 'Available' },
  ]);
  await many(M.EquipmentMaintenance, [
    { equipment_id: eq[0]._id, maintenance_date: daysAgo(40), type: 'Service', description: '250-hour service, oil and filters', cost: 4200, performed_by: 'JD dealership', next_maintenance: daysAhead(140) },
    { equipment_id: eq[1]._id, maintenance_date: daysAgo(6), type: 'Repair', description: 'Clutch replacement', cost: 18500, performed_by: 'Workshop', next_maintenance: daysAhead(90) },
    { equipment_id: eq[2]._id, maintenance_date: daysAgo(70), type: 'Inspection', description: 'Nozzle calibration and seal check', cost: 900, performed_by: 'Field team' },
  ]);

  const expCats = ['Seeds', 'Fertilizer', 'Pesticides', 'Labor', 'Irrigation', 'Machinery', 'Fuel', 'Transport', 'Storage', 'Equipment'];
  await many(M.Expense, Array.from({ length: 28 }).map((_, i) => ({
    farm_id: pick([gve._id, krf._id], i), crop_cycle_id: pick(cycles, i)._id,
    category: pick(expCats, i), description: `${pick(expCats, i)} purchase / payment`,
    amount: rand(1500, 45000), expense_date: monthStart(i % 12),
    payment_method: pick(['Bank transfer', 'Mobile money', 'Cash', 'Cheque'], i),
    supplier: pick(['Omnia', 'SeedCo', 'ETG', 'Puma', 'Local contractor', 'Nyiombo'], i),
  })));

  const buyers = ['ZdMillers Ltd', 'Kafue Grain Traders', 'Fresh Market Lusaka', 'Export Co-op', 'Local aggregator'];
  await many(M.Sale, Array.from({ length: 16 }).map((_, i) => {
    const cn = pick(['Maize', 'Soybean', 'Wheat', 'Groundnut', 'Sunflower', 'Tomato', 'Onion'], i);
    const price = cn === 'Tomato' ? rand(6, 14) : cn === 'Onion' ? rand(8, 16) : rand(3, 9);
    return {
      farm_id: pick([gve._id, krf._id], i), crop_id: C[cn]._id, crop_cycle_id: pick(cycles, i)._id,
      buyer: pick(buyers, i), quantity: rand(2000, 40000), unit: 'kg', unit_price: price,
      sale_date: monthStart(i % 12), market: pick(['Lusaka', 'Kafue', 'Export', 'Farm gate'], i),
      payment_status: pick(['Paid', 'Paid', 'Pending', 'Partially Paid', 'Paid'], i),
    };
  }));

  await many(M.Notification, [
    { type: 'warning', title: 'Low stock', message: 'Urea is below its minimum stock level.', is_read: false },
    { type: 'danger', title: 'Out of stock', message: 'Emamectin benzoate has zero stock.', is_read: false },
    { type: 'info', title: 'Harvest ready', message: 'Wheat on River Field is ready for harvest.', is_read: false },
    { type: 'warning', title: 'Expiring input', message: 'Glyphosate 480 expires within 30 days.', is_read: false },
  ]);

  const counts = {};
  for (const Model of OWNED_MODELS) {
    const n = await Model.countDocuments({ user_id: userId });
    if (n) counts[Model.modelName] = n;
  }
  return counts;
}
