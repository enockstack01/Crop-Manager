import mongoose from 'mongoose';
import { ownedSchema } from './_base.js';
import { CURRENCY_CODES } from '../lib/currencies.js';

/**
 * Account lifecycle. A new sign-up is `new` until it submits the access-request form
 * (`pending`); an administrator then approves (`active`) or rejects it, and can later
 * put the account `on_hold`, `deactivated`, or re-activate it. Only `active` accounts
 * (and admins) can use the farm API.
 */
export const ACCOUNT_STATUSES = ['new', 'pending', 'active', 'on_hold', 'rejected', 'deactivated'];

const ProfileSchema = ownedSchema({
  full_name: { type: String, trim: true },
  email: { type: String, trim: true },
  phone: { type: String, trim: true },
  location: { type: String, trim: true },
  role: { type: String, default: 'Farmer' }, // account type, changed only by an admin
  avatar_url: { type: String, default: null },
  onboarded: { type: Boolean, default: false },
  is_admin: { type: Boolean, default: false }, // platform administrator — NOT user-editable
  is_active: { type: Boolean, default: false }, // mirrors account_status === 'active'
  account_status: { type: String, enum: ACCOUNT_STATUSES, default: 'new' },
  status_reason: { type: String, trim: true, default: '' }, // shown to the user (e.g. why rejected / on hold)
  status_updated_at: { type: Date, default: null },
  status_updated_by: { type: String, default: null },
  approved_at: { type: Date, default: null }, // first approval of the access request
  // the access-request form: { organization, country, farm_size, farm_size_unit, main_crops,
  // account_type, message, submitted_at }
  access_request: { type: mongoose.Schema.Types.Mixed, default: null },
  currency: { type: String, enum: CURRENCY_CODES, default: 'USD' },
  language: { type: String, enum: ['en', 'fr', 'rw', 'sw', null], default: null }, // interface language (web + mobile)
  last_seen_at: { type: Date, default: null },
});
ProfileSchema.index({ user_id: 1 }, { unique: true });

const NotificationSchema = ownedSchema({
  type: { type: String, default: 'info' },
  title: { type: String, trim: true },
  message: { type: String, trim: true },
  is_read: { type: Boolean, default: false },
});

const CalculationHistorySchema = ownedSchema({
  calculator_type: { type: String, required: true },
  inputs: { type: mongoose.Schema.Types.Mixed, default: {} },
  result: { type: mongoose.Schema.Types.Mixed, default: {} },
});

// Platform-wide key/value config (not user-owned).
const SystemSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    updated_by: { type: String, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { versionKey: false, transform: (_d, r) => { r.id = r._id?.toString(); delete r._id; return r; } },
  }
);

export const Profile = mongoose.model('Profile', ProfileSchema);
export const Notification = mongoose.model('Notification', NotificationSchema);
export const CalculationHistory = mongoose.model('CalculationHistory', CalculationHistorySchema);
export const SystemSetting = mongoose.model('SystemSetting', SystemSettingSchema);
