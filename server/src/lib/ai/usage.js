import mongoose from 'mongoose';
import { ownedSchema } from '../../models/_base.js';
import { SystemSetting } from '../../models/system.models.js';
import createHttpError from '../httpError.js';
import { AI_DAILY_LIMIT, AI_HOURLY_LIMIT, AI_MODEL } from './client.js';

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
const HOUR = 3_600_000;

/* ---- platform limits: set by an administrator, env values are the defaults ---- */
let cached = null;
let cachedAt = 0;

export async function getLimits() {
  if (cached && Date.now() - cachedAt < 30_000) return cached;
  const row = await SystemSetting.findOne({ key: 'ai_limits' }).lean().catch(() => null);
  cached = {
    daily: Number.isInteger(row?.value?.daily) ? row.value.daily : AI_DAILY_LIMIT,
    hourly: Number.isInteger(row?.value?.hourly) ? row.value.hourly : AI_HOURLY_LIMIT,
  };
  cachedAt = Date.now();
  return cached;
}

export async function setLimits({ daily, hourly }, by) {
  await SystemSetting.findOneAndUpdate({ key: 'ai_limits' }, { $set: { value: { daily, hourly }, updated_by: by } }, { upsert: true });
  cached = null;
  return getLimits();
}

/** What a user may do right now: limits, requests used in the last hour and today, and what is left. */
export async function usageFor(profile) {
  if (profile?.is_admin) return { limit: null, remaining: null, hourly_limit: null, hourly_remaining: null };
  const limits = await getLimits();
  const daily = Number.isInteger(profile?.ai_daily_limit) ? profile.ai_daily_limit : limits.daily;
  const [usedDay, usedHour] = await Promise.all([
    AiUsage.countDocuments({ user_id: profile.user_id, day: today() }),
    AiUsage.countDocuments({ user_id: profile.user_id, created_at: { $gte: new Date(Date.now() - HOUR) } }),
  ]);
  return {
    limit: daily,
    remaining: Math.max(0, daily - usedDay),
    hourly_limit: limits.hourly,
    hourly_remaining: Math.max(0, limits.hourly - usedHour),
  };
}

/** Throws 429 once a farmer has used the hour's or the day's allowance. */
export async function assertWithinLimit(profile) {
  const u = await usageFor(profile);
  if (u.remaining === 0) {
    throw createHttpError(429, u.limit === 0 ? 'AI requests are turned off for your account. Contact an administrator.' : 'You have used all of today\'s AI requests. They reset tomorrow.', { code: 'ai_limit', scope: 'day' });
  }
  if (u.hourly_remaining === 0) {
    const oldest = await AiUsage.findOne({ user_id: profile.user_id, created_at: { $gte: new Date(Date.now() - HOUR) } }).sort({ created_at: 1 }).lean();
    const wait = Math.max(1, Math.ceil((new Date(oldest?.created_at || Date.now()).getTime() + HOUR - Date.now()) / 60_000));
    throw createHttpError(429, `You have used this hour's AI requests. Try again in about ${wait} minute${wait === 1 ? '' : 's'}.`, { code: 'ai_limit', scope: 'hour', retry_after_minutes: wait });
  }
}

export const logUsage = (userId, feature, usage = {}) =>
  AiUsage.create({ user_id: userId, feature, day: today(), model: AI_MODEL, ...usage }).catch((e) => console.error('[ai] usage log failed', e.message));

/** Platform-wide numbers for the admin screen. */
export async function usageSummary() {
  const day = today();
  const [totals, top] = await Promise.all([
    AiUsage.aggregate([{ $match: { day } }, { $group: { _id: null, requests: { $sum: 1 }, users: { $addToSet: '$user_id' }, input: { $sum: '$input_tokens' }, output: { $sum: '$output_tokens' } } }]),
    AiUsage.aggregate([{ $match: { day } }, { $group: { _id: '$user_id', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }]),
  ]);
  const t = totals[0] || {};
  return { requests: t.requests || 0, users: t.users?.length || 0, input_tokens: t.input || 0, output_tokens: t.output || 0, top: top.map((x) => ({ user_id: x._id, count: x.count })) };
}
