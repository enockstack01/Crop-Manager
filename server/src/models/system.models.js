import mongoose from 'mongoose';
import { ownedSchema } from './_base.js';

const ProfileSchema = ownedSchema({
  full_name: { type: String, trim: true },
  email: { type: String, trim: true },
  phone: { type: String, trim: true },
  location: { type: String, trim: true },
  role: { type: String, default: 'Farmer' },
  avatar_url: { type: String, default: null },
  onboarded: { type: Boolean, default: false },
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

export const Profile = mongoose.model('Profile', ProfileSchema);
export const Notification = mongoose.model('Notification', NotificationSchema);
export const CalculationHistory = mongoose.model('CalculationHistory', CalculationHistorySchema);
