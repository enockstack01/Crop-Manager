import mongoose from 'mongoose';
import { ownedSchema } from '../../models/_base.js';
import { SystemSetting } from '../../models/system.models.js';
import createHttpError from '../httpError.js';
import { AI_DAILY_LIMIT, AI_HOURLY_LIMIT } from './client.js';

/** One row per AI request: who asked, which feature, what it cost in tokens. */
const AiUsageSchema = ownedSchema({
  feature: { type: String, required: true },
  day: { type: String, required: true, index: true }, // YYYY-MM-DD (UTC)
  model: { type: String }, // the tier name (Fast, Balanced...), never the real model id
  ok: { type: Boolean, default: true },
  error_code: { type: String, default: '' },
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

export const logUsage = (userId, feature, usage = {}, tier = '') =>
  AiUsage.create({ user_id: userId, feature, day: today(), model: tier, ...usage }).catch((e) => console.error('[ai] usage log failed', e.message));

/** A request that failed after it started (shown to administrators as errors; it does not use up the allowance). */
export const logFailure = (userId, feature, tier = '', code = 'failed') =>
  AiUsage.create({ user_id: userId, feature, day: today(), model: tier, ok: false, error_code: code }).catch(() => {});

/** Usage over the last `days` days for the admin screen: totals, by day, by model, by feature, heaviest users. */
export async function usageReport(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const match = { $match: { day: { $gte: since } } };
  const sum = { requests: { $sum: { $cond: ['$ok', 1, 0] } }, errors: { $sum: { $cond: ['$ok', 0, 1] } }, input: { $sum: '$input_tokens' }, output: { $sum: '$output_tokens' }, cached: { $sum: '$cache_read_tokens' } };
  const [total, byDay, byModel, byFeature, top, usersNow] = await Promise.all([
    AiUsage.aggregate([match, { $group: { _id: null, ...sum, users: { $addToSet: '$user_id' } } }]),
    AiUsage.aggregate([match, { $group: { _id: '$day', ...sum } }, { $sort: { _id: 1 } }]),
    AiUsage.aggregate([match, { $group: { _id: '$model', ...sum } }, { $sort: { requests: -1 } }]),
    AiUsage.aggregate([match, { $group: { _id: '$feature', ...sum } }, { $sort: { requests: -1 } }]),
    AiUsage.aggregate([match, { $group: { _id: '$user_id', count: { $sum: 1 }, tokens: { $sum: { $add: ['$input_tokens', '$output_tokens'] } } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    AiUsage.aggregate([{ $match: { day: today() } }, { $group: { _id: '$user_id' } }]),
  ]);
  const t = total[0] || {};
  const row = (r) => ({ requests: r.requests || 0, errors: r.errors || 0, input_tokens: r.input || 0, output_tokens: r.output || 0, cached_tokens: r.cached || 0 });
  return {
    days,
    totals: { ...row(t), users: t.users?.length || 0, users_today: usersNow.length },
    by_day: byDay.map((r) => ({ day: r._id, ...row(r) })),
    by_model: byModel.map((r) => ({ model: r._id || 'unknown', ...row(r) })),
    by_feature: byFeature.map((r) => ({ feature: r._id, ...row(r) })),
    top_users: top.map((r) => ({ user_id: r._id, count: r.count, tokens: r.tokens })),
  };
}

/** Today's requests, kept for the settings summary. */
export async function usageSummary() {
  const r = await usageReport(1);
  return { requests: r.totals.requests, users: r.totals.users_today, input_tokens: r.totals.input_tokens, output_tokens: r.totals.output_tokens, top: r.top_users.slice(0, 5).map((x) => ({ user_id: x.user_id, count: x.count })) };
}
