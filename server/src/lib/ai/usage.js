import mongoose from 'mongoose';
import { ownedSchema } from '../../models/_base.js';
import createHttpError from '../httpError.js';
import { AI_DAILY_LIMIT, AI_MODEL } from './client.js';

/** One row per AI request: who asked, which feature, what it cost in tokens. */
const AiUsageSchema = ownedSchema({
  feature: { type: String, required: true },
  day: { type: String, required: true, index: true }, // YYYY-MM-DD (UTC)
  model: { type: String },
  input_tokens: { type: Number, default: 0 },
  output_tokens: { type: Number, default: 0 },
  cache_read_tokens: { type: Number, default: 0 },
});
AiUsageSchema.index({ user_id: 1, day: 1 });

export const AiUsage = mongoose.models.AiUsage || mongoose.model('AiUsage', AiUsageSchema);

const today = () => new Date().toISOString().slice(0, 10);

export async function remainingToday(profile) {
  if (profile?.is_admin) return { limit: null, remaining: null };
  const used = await AiUsage.countDocuments({ user_id: profile.user_id, day: today() });
  return { limit: AI_DAILY_LIMIT, remaining: Math.max(0, AI_DAILY_LIMIT - used) };
}

/** Throws 429 once a farmer has used the day's allowance. */
export async function assertWithinLimit(profile) {
  const { remaining } = await remainingToday(profile);
  if (remaining === 0) {
    throw createHttpError(429, 'You have used all of today\'s AI requests. They reset tomorrow.', { code: 'ai_limit' });
  }
}

export const logUsage = (userId, feature, usage = {}) =>
  AiUsage.create({ user_id: userId, feature, day: today(), model: AI_MODEL, ...usage }).catch((e) => console.error('[ai] usage log failed', e.message));
