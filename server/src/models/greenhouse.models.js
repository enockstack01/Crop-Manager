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
  fruit_weight_g: { type: Number, min: 0.1, max: 20000, default: 100 }, // one ripe fruit, in grams
  price_per_kg: { type: Number, min: 0, max: 1e9, default: null }, // what the farmer sells it for; null = not set
  currency: { type: String, trim: true, maxlength: 8, default: 'USD' },
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
  label: { type: String, trim: true, default: '' }, // a short name the person gives this count, for example "first flush"
  fruit_size: { type: String, enum: ['all', 'small', 'medium', 'large'], default: 'all' }, // which fruit this count is about ('all' = every size, no categories)
  photo_urls: { type: [String], default: [] }, // every photo taken of the plant; photo_url is then the collage of them
  collage: { type: mongoose.Schema.Types.Mixed, default: null }, // { photos, columns, overlap_warnings } when several photos were joined
  entered_by: { type: String, default: '' }, // the account that recorded it (the farm owner or a data collector)
  entered_by_name: { type: String, default: '' },
  client_id: { type: String, trim: true, maxlength: 64 }, // made by the phone when a count is recorded, so a count sent twice (a lost reply, a retry after offline) is saved once
  recorded_at: { type: Date }, // when the person recorded it, which can be earlier than when it reached the server (recorded offline)
  alerts_ack: { type: mongoose.Schema.Types.Mixed, default: {} }, // explanations of theft/loss alerts: { under_recorded: { reason, by, at }, fall: {...} }
});
FruitCountSchema.index({ user_id: 1, count_date: -1 });
FruitCountSchema.index({ user_id: 1, client_id: 1 }, { unique: true, partialFilterExpression: { client_id: { $type: 'string' } } });

export const GreenhouseCrop = mongoose.model('GreenhouseCrop', GreenhouseCropSchema);
export const FruitCount = mongoose.model('FruitCount', FruitCountSchema);

/** A greenhouse laid out as rows of plants: its size, the rows, and the plants in each row. Every plant is "R<row> P<plant>", counted from 1. */
const GreenhouseHouseSchema = ownedSchema({
  name: { type: String, required: true, trim: true },
  length_m: { type: Number, required: true, min: 1, max: 500 },
  width_m: { type: Number, required: true, min: 1, max: 200 },
  rows: { type: Number, required: true, min: 1, max: 100 },
  plants_per_row: { type: Number, required: true, min: 1, max: 300 },
  crop_id: { ...ref('GreenhouseCrop'), default: null },
  row_crops: { type: [String], default: [] }, // optional: a different crop for a row, by row number - 1 ('' = the greenhouse crop)
  notes: { type: String, trim: true },
  // the shape of the house: each row can have its own number of positions, start later, and hold two side-by-side sub rows (A and B)
  row_defs: { type: [new mongoose.Schema({ plants: Number, start: { type: Number, default: 0 }, sub_rows: { type: Number, default: 1 } }, { _id: false })], default: [] },
  orientation_deg: { type: Number, default: 0, min: 0, max: 359 }, // the compass direction the top wall of the plan faces (0 = north)
  door: { type: new mongoose.Schema({ wall: { type: String, enum: ['top', 'bottom', 'left', 'right'], default: 'bottom' }, position: { type: Number, default: 0.5, min: 0, max: 1 }, width_m: { type: Number, default: 1.2, min: 0.5, max: 10 } }, { _id: false }), default: null },
  pattern: { type: String, enum: ['grid', 'zigzag', 'staggered'], default: 'grid' }, // how the plants sit in a row
  plant_spacing_m: { type: Number, default: null, min: 0.05, max: 20 }, // null = spread the plants along the house
  row_spacing_m: { type: Number, default: null, min: 0.1, max: 20 },
  positions: { type: mongoose.Schema.Types.Mixed, default: {} }, // "R2A|P3" -> { state: 'frozen' | 'inactive', reason, by, by_name, at, label }
  position_log: { type: [mongoose.Schema.Types.Mixed], default: [] }, // newest last, kept to the last 300 changes
});
GreenhouseHouseSchema.index({ user_id: 1, name: 1 }, { unique: true });

export const GreenhouseHouse = mongoose.model('GreenhouseHouse', GreenhouseHouseSchema);

/**
 * The farm manager's team. A person the farm manager (user_id, the owner of the records) invites to help in the field:
 *   collector  a data collector: records entries into the manager's farm, tagged with their name, with a simpler dashboard (see lib/farmPolicy.js)
 *   manager    (older, greenhouse only) a second manager who can read the greenhouse records and disease details
 * The invitation becomes the person's account when they first sign in with the invited address, and then waits for a system administrator's
 * approval like every account. Removing a member ends their access; the entries they made stay in the farm's records.
 * Kept in the collection the greenhouse team used before, so earlier invitations keep working.
 */
const FarmMemberSchema = ownedSchema({ // user_id is the farm manager (the owner of the records)
  member_id: { type: String, default: null, index: true }, // the member's own account, set when they sign in with the invited address
  invited_email: { type: String, trim: true, lowercase: true, required: true },
  name: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  role: { type: String, enum: ['manager', 'collector'], required: true },
  status: { type: String, enum: ['invited', 'active', 'removed'], default: 'invited' },
  invited_at: { type: Date, default: Date.now },
  expires_at: { type: Date, default: null }, // an invitation not accepted by then reads as expired (resending renews it)
  email_sent: { type: Boolean, default: false },
  email_error: { type: String, default: '' },
  sent_count: { type: Number, default: 0 },
  last_sent_at: { type: Date, default: null },
  accepted_at: { type: Date, default: null },
  ended_at: { type: Date, default: null },
  ended_as: { type: String, enum: ['cancelled', 'removed', null], default: null }, // an invitation cancelled before it was accepted, or a member removed
  last_activity_at: { type: Date, default: null }, // the last time they used the farm's records
});
FarmMemberSchema.index({ user_id: 1, invited_email: 1 }, { unique: true });
export const FarmMember = mongoose.model('FarmMember', FarmMemberSchema, 'greenhousemembers');
export const GreenhouseMember = FarmMember; // the name the greenhouse code and its tests use
