import mongoose from 'mongoose';
import { ownedSchema, ref } from './_base.js';

/** A greenhouse crop the farmer grows: picked from the built-in list (catalog_key) or their own ('custom'). Carries what the fruit counter needs. */
const GreenhouseCropSchema = ownedSchema({
  catalog_key: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  fruit_colors: { type: [String], default: ['red'] },
  shape: { type: String, enum: ['round', 'elongated'], default: 'round' },
  contrast: { type: String, enum: ['high', 'low'], default: 'high' },
  notes: { type: String, trim: true },
});
GreenhouseCropSchema.index({ user_id: 1, catalog_key: 1 });

/** The fruit on one plant on one day: a photo, the row, and the number the farmer counted, with the result of the photo check. */
const FruitCountSchema = ownedSchema({
  crop_id: { ...ref('GreenhouseCrop'), required: true, index: true },
  crop_name: { type: String, trim: true },
  greenhouse: { type: String, trim: true, default: '' },
  row_id: { type: String, required: true, trim: true },
  plant_label: { type: String, trim: true, default: '' },
  count_date: { type: String, required: true, index: true },
  recorded_count: { type: Number, required: true, min: 0, max: 10000 },
  photo_url: { type: String, required: true },
  annotated_url: { type: String, default: null },
  verification: { type: mongoose.Schema.Types.Mixed, default: null },
  notes: { type: String, trim: true },
});
FruitCountSchema.index({ user_id: 1, count_date: -1 });

export const GreenhouseCrop = mongoose.model('GreenhouseCrop', GreenhouseCropSchema);
export const FruitCount = mongoose.model('FruitCount', FruitCountSchema);
