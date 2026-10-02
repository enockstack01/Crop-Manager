import mongoose from 'mongoose';
import { ownedSchema, ref } from './_base.js';
import { currencyField } from '../lib/currencies.js';

const CropCycleSchema = ownedSchema({
  farm_id: { ...ref('Farm'), required: true, index: true },
  field_id: { ...ref('Field'), required: true, index: true },
  crop_id: { ...ref('Crop'), required: true, index: true },
  variety_id: { ...ref('CropVariety'), default: null },
  season_id: { ...ref('Season'), default: null, index: true },
  planting_date: { type: String, default: null },
  expected_harvest_date: { type: String, default: null },
  actual_harvest_date: { type: String, default: null },
  area_planted: { type: Number, default: null },
  area_unit: { type: String, default: 'hectares' },
  seed_quantity: { type: Number, default: null },
  seed_unit: { type: String, default: 'kg' },
  expected_production: { type: Number, default: null },
  expected_production_unit: { type: String, default: 'kg' },
  actual_production: { type: Number, default: null },
  actual_production_unit: { type: String, default: 'kg' },
  status: { type: String, default: 'Planned' },
  notes: { type: String, trim: true },
});

const PlantingRecordSchema = ownedSchema({
  currency: currencyField, // money values in this record are in this currency
  crop_cycle_id: { ...ref('CropCycle'), required: true, index: true },
  farm_id: { ...ref('Farm'), default: null },
  field_id: { ...ref('Field'), default: null },
  planting_date: { type: String, default: null },
  seed_quantity: { type: Number, default: null },
  seed_unit: { type: String, default: 'kg' },
  seed_source: { type: String, trim: true },
  seed_cost: { type: Number, default: null },
  row_spacing: { type: Number, default: null },
  plant_spacing: { type: Number, default: null },
  spacing_unit: { type: String, default: 'cm' },
  planting_method: { type: String, trim: true },
  notes: { type: String, trim: true },
});

const FieldActivitySchema = ownedSchema({
  currency: currencyField, // money values in this record are in this currency
  farm_id: { ...ref('Farm'), default: null, index: true },
  field_id: { ...ref('Field'), default: null },
  crop_cycle_id: { ...ref('CropCycle'), default: null },
  activity_type: { type: String, required: true },
  activity_date: { type: String, required: true },
  description: { type: String, trim: true },
  labor_cost: { type: Number, default: 0 },
  equipment_cost: { type: Number, default: 0 },
  material_cost: { type: Number, default: 0 },
  total_cost: { type: Number, default: 0 },
  performed_by: { type: String, trim: true },
  notes: { type: String, trim: true },
});
const activityTotal = (d) => (d.labor_cost || 0) + (d.equipment_cost || 0) + (d.material_cost || 0);
FieldActivitySchema.pre('save', function computeTotal(next) {
  this.total_cost = activityTotal(this);
  next();
});
FieldActivitySchema.pre('insertMany', function (next, docs) {
  docs.forEach((d) => { d.total_cost = activityTotal(d); });
  next();
});

const IrrigationRecordSchema = ownedSchema({
  currency: currencyField, // money values in this record are in this currency
  farm_id: { ...ref('Farm'), default: null, index: true },
  field_id: { ...ref('Field'), default: null },
  crop_cycle_id: { ...ref('CropCycle'), default: null },
  irrigation_date: { type: String, required: true },
  irrigation_method: { type: String, required: true },
  duration_hours: { type: Number, default: null },
  water_volume: { type: Number, default: null },
  water_unit: { type: String, default: 'cubic metres' },
  area_irrigated: { type: Number, default: null },
  area_unit: { type: String, default: 'hectares' },
  cost: { type: Number, default: 0 },
  operator: { type: String, trim: true },
  notes: { type: String, trim: true },
});

const FertilizerApplicationSchema = ownedSchema({
  currency: currencyField, // money values in this record are in this currency
  farm_id: { ...ref('Farm'), default: null, index: true },
  field_id: { ...ref('Field'), default: null },
  crop_cycle_id: { ...ref('CropCycle'), default: null },
  application_date: { type: String, required: true },
  fertilizer_name: { type: String, required: true, trim: true },
  fertilizer_type: { type: String, required: true },
  quantity: { type: Number, default: null },
  unit: { type: String, default: 'kg' },
  application_method: { type: String, trim: true },
  cost: { type: Number, default: 0 },
  supplier: { type: String, trim: true },
  applied_by: { type: String, trim: true },
  notes: { type: String, trim: true },
});

const CropProtectionRecordSchema = ownedSchema({
  currency: currencyField, // money values in this record are in this currency
  farm_id: { ...ref('Farm'), default: null, index: true },
  field_id: { ...ref('Field'), default: null },
  crop_cycle_id: { ...ref('CropCycle'), default: null },
  protection_date: { type: String, required: true },
  problem_type: { type: String, required: true },
  problem_name: { type: String, required: true, trim: true },
  severity: { type: String },
  treatment: { type: String, trim: true },
  product_name: { type: String, trim: true },
  quantity: { type: Number, default: null },
  unit: { type: String, default: 'litres' },
  application_method: { type: String, trim: true },
  cost: { type: Number, default: 0 },
  applied_by: { type: String, trim: true },
  notes: { type: String, trim: true },
});

const CropScoutingRecordSchema = ownedSchema({
  farm_id: { ...ref('Farm'), default: null, index: true },
  field_id: { ...ref('Field'), default: null },
  crop_id: { ...ref('Crop'), default: null },
  crop_cycle_id: { ...ref('CropCycle'), default: null },
  scouting_date: { type: String, required: true },
  scout_name: { type: String, trim: true },
  growth_stage: { type: String, trim: true },
  plant_health: { type: String, default: 'Healthy' },
  pest_observation: { type: String, trim: true },
  disease_observation: { type: String, trim: true },
  weed_observation: { type: String, trim: true },
  soil_observation: { type: String, trim: true },
  moisture_observation: { type: String, trim: true },
  recommendation: { type: String, trim: true },
  photo_url: { type: String, default: null },
  notes: { type: String, trim: true },
});

const HarvestRecordSchema = ownedSchema({
  currency: currencyField, // money values in this record are in this currency
  farm_id: { ...ref('Farm'), default: null, index: true },
  field_id: { ...ref('Field'), default: null },
  crop_id: { ...ref('Crop'), required: true, index: true },
  crop_cycle_id: { ...ref('CropCycle'), default: null },
  harvest_date: { type: String, required: true, index: true },
  harvested_area: { type: Number, default: null },
  area_unit: { type: String, default: 'hectares' },
  quantity: { type: Number, required: true },
  unit: { type: String, default: 'kg' },
  grade: { type: String, trim: true },
  quality: { type: String },
  storage_location: { type: String, trim: true },
  labor_cost: { type: Number, default: 0 },
  transport_cost: { type: Number, default: 0 },
  other_costs: { type: Number, default: 0 },
  notes: { type: String, trim: true },
});

export const CropCycle = mongoose.model('CropCycle', CropCycleSchema);
export const PlantingRecord = mongoose.model('PlantingRecord', PlantingRecordSchema);
export const FieldActivity = mongoose.model('FieldActivity', FieldActivitySchema);
export const IrrigationRecord = mongoose.model('IrrigationRecord', IrrigationRecordSchema);
export const FertilizerApplication = mongoose.model('FertilizerApplication', FertilizerApplicationSchema);
export const CropProtectionRecord = mongoose.model('CropProtectionRecord', CropProtectionRecordSchema);
export const CropScoutingRecord = mongoose.model('CropScoutingRecord', CropScoutingRecordSchema);
export const HarvestRecord = mongoose.model('HarvestRecord', HarvestRecordSchema);
