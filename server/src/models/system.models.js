import mongoose from 'mongoose';
import { ownedSchema } from './_base.js';

const ProfileSchema = ownedSchema({
  full_name: { type: String, trim: true },
  email: { type: String, trim: true },
  phone: { type: String, trim: true },
  location: { type: String, trim: true },
  role: { type: String, default: 'Farmer' }, // job title (cosmetic), user-editable
  avatar_url: { type: String, default: null },
  onboarded: { type: Boolean, default: false },
  is_admin: { type: Boolean, default: false }, // platform administrator — NOT user-editable
  is_active: { type: Boolean, default: true }, // deactivated accounts are blocked from the API
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
