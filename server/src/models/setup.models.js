import mongoose from 'mongoose';
import { ownedSchema, ref } from './_base.js';

const FarmSchema = ownedSchema({
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true },
  description: { type: String, trim: true },
  location: { type: String, trim: true },
  district: { type: String, trim: true },
  province: { type: String, trim: true },
  country: { type: String, trim: true, default: 'Zambia' },
  total_area: { type: Number, default: null },
  area_unit: { type: String, default: 'hectares' },
  farm_type: { type: String, default: 'Crop' },
  notes: { type: String, trim: true },
});

const FieldSchema = ownedSchema({
  farm_id: { ...ref('Farm'), required: true, index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true },
  area: { type: Number, default: null },
  area_unit: { type: String, default: 'hectares' },
  location: { type: String, trim: true },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  soil_type: { type: String, trim: true },
  soil_ph: { type: Number, default: null },
  status: { type: String, default: 'Active' },
  notes: { type: String, trim: true },
});

const CropSchema = ownedSchema({
  name: { type: String, required: true, trim: true },
  category: { type: String, trim: true },
  description: { type: String, trim: true },
  typical_growing_period: { type: Number, default: null },
  growing_period_unit: { type: String, default: 'days' },
  notes: { type: String, trim: true },
});

const CropVarietySchema = ownedSchema({
  crop_id: { ...ref('Crop'), required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  maturity_period: { type: Number, default: null },
  maturity_period_unit: { type: String, default: 'days' },
  seed_source: { type: String, trim: true },
  notes: { type: String, trim: true },
});

const SeasonSchema = ownedSchema({
  name: { type: String, required: true, trim: true },
  start_date: { type: String, default: null },
  end_date: { type: String, default: null },
  description: { type: String, trim: true },
  status: { type: String, default: 'Active' },
  notes: { type: String, trim: true },
});

export const Farm = mongoose.model('Farm', FarmSchema);
export const Field = mongoose.model('Field', FieldSchema);
export const Crop = mongoose.model('Crop', CropSchema);
export const CropVariety = mongoose.model('CropVariety', CropVarietySchema);
export const Season = mongoose.model('Season', SeasonSchema);
