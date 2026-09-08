import * as M from './models/index.js';

const farm = { from: 'farm_id', to: 'farms', fields: ['name'] };
const field = { from: 'field_id', to: 'fields', fields: ['name'] };
const crop = { from: 'crop_id', to: 'crops', fields: ['name'] };
const variety = { from: 'variety_id', to: 'crop_varieties', fields: ['name'] };
const season = { from: 'season_id', to: 'seasons', fields: ['name'] };
// crop_cycle relation, optionally with the cycle's own crop name nested underneath
const cycle = (withCrop = true) => ({
  from: 'crop_cycle_id',
  to: 'crop_cycles',
  fields: [],
  children: withCrop
    ? [{ from: 'crop_id', to: 'crops', fields: ['name'] }]
    : [farm, field, crop, season],
});

/**
 * Declarative registry — one entry drives a full REST CRUD surface at /api/:path
 * via crudController + generic routes.
 */
export const resources = [
  {
    path: 'farms', name: 'Farm', model: M.Farm,
    search: ['name', 'code', 'location'],
  },
  {
    path: 'fields', name: 'Field', model: M.Field,
    search: ['name', 'code', 'soil_type'], filters: ['farm_id', 'status'],
    relations: [farm],
  },
  {
    path: 'crops', name: 'Crop', model: M.Crop,
    search: ['name', 'category'], defaultSort: 'name', defaultOrder: 'asc',
  },
  {
    path: 'crop-varieties', name: 'Variety', model: M.CropVariety,
    search: ['name', 'description'], filters: ['crop_id'],
    relations: [crop],
  },
  {
    path: 'seasons', name: 'Season', model: M.Season,
    search: ['name', 'description'], filters: ['status'],
  },
  {
    path: 'crop-cycles', name: 'Crop cycle', model: M.CropCycle,
    search: ['notes'], filters: ['farm_id', 'crop_id', 'season_id', 'status'],
    relations: [farm, field, crop, variety, season],
  },
  {
    path: 'planting-records', name: 'Planting record', model: M.PlantingRecord,
    search: ['seed_source', 'planting_method'], filters: ['crop_cycle_id'],
    defaultSort: 'planting_date',
    relations: [cycle(false)],
  },
  {
    path: 'field-activities', name: 'Activity', model: M.FieldActivity,
    search: ['description', 'performed_by'], filters: ['farm_id', 'activity_type'],
    defaultSort: 'activity_date',
    relations: [farm, field, cycle()],
  },
  {
    path: 'irrigation-records', name: 'Irrigation record', model: M.IrrigationRecord,
    filters: ['farm_id', 'irrigation_method'], defaultSort: 'irrigation_date',
    relations: [farm, field, cycle()],
  },
  {
    path: 'fertilizer-applications', name: 'Fertilizer application', model: M.FertilizerApplication,
    search: ['fertilizer_name', 'supplier'], filters: ['farm_id', 'fertilizer_type'],
    defaultSort: 'application_date',
    relations: [farm, field, cycle()],
  },
  {
    path: 'crop-protection-records', name: 'Crop protection record', model: M.CropProtectionRecord,
    search: ['problem_name', 'treatment', 'product_name'],
    filters: ['farm_id', 'problem_type', 'severity'], defaultSort: 'protection_date',
    relations: [farm, field, cycle()],
  },
  {
    path: 'crop-scouting-records', name: 'Scouting record', model: M.CropScoutingRecord,
    search: ['scout_name', 'growth_stage', 'pest_observation', 'disease_observation'],
    filters: ['farm_id', 'plant_health'], defaultSort: 'scouting_date',
    relations: [farm, field, crop, cycle()],
  },
  {
    path: 'harvest-records', name: 'Harvest record', model: M.HarvestRecord,
    search: ['storage_location', 'grade'], filters: ['farm_id', 'crop_id'],
    defaultSort: 'harvest_date',
    relations: [farm, field, crop, cycle()],
  },
  {
    path: 'inventory-items', name: 'Inventory item', model: M.InventoryItem,
    search: ['name', 'supplier', 'storage_location'], filters: ['category'],
    defaultSort: 'name', defaultOrder: 'asc',
  },
  {
    path: 'inventory-transactions', name: 'Inventory transaction', model: M.InventoryTransaction,
    filters: ['item_id'], defaultSort: 'created_at',
  },
  {
    path: 'equipment', name: 'Equipment', model: M.Equipment,
    search: ['name', 'model', 'serial_number'], filters: ['status'],
  },
  {
    path: 'equipment-maintenance', name: 'Maintenance record', model: M.EquipmentMaintenance,
    search: ['description', 'performed_by'], filters: ['equipment_id'],
    defaultSort: 'maintenance_date',
    relations: [{ from: 'equipment_id', to: 'equipment', fields: ['name'] }],
  },
  {
    path: 'expenses', name: 'Expense', model: M.Expense,
    search: ['description', 'supplier'], filters: ['farm_id', 'category'],
    defaultSort: 'expense_date',
    relations: [farm],
  },
  {
    path: 'sales', name: 'Sale', model: M.Sale,
    search: ['buyer', 'market'], filters: ['farm_id', 'crop_id', 'payment_status'],
    defaultSort: 'sale_date',
    relations: [farm, crop],
  },
  {
    path: 'notifications', name: 'Notification', model: M.Notification,
    filters: ['is_read'], defaultSort: 'created_at',
  },
  {
    path: 'calculation-history', name: 'Calculation', model: M.CalculationHistory,
    defaultSort: 'created_at',
  },
];

export const resourceByPath = Object.fromEntries(resources.map((r) => [r.path, r]));
