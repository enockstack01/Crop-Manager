import createHttpError from '../lib/httpError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { Profile } from '../models/index.js';
import { aiConfigured, aiMock, askText } from '../lib/ai/client.js';
import { TASKS, TIERS, getModelSettings, setModelSettings } from '../lib/ai/models.js';
import { getLimits, logFailure, logUsage, usageReport } from '../lib/ai/usage.js';
import { audit } from '../lib/orgs/core.js';

/** What the admin screen shows: tiers by neutral name (never the model ids), per-task choice, limits, usage. */
async function overview(days) {
  const [settings, limits, usage] = await Promise.all([getModelSettings(), getLimits(), usageReport(days)]);
  const names = await Profile.find({ user_id: { $in: usage.top_users.map((u) => u.user_id) } }, 'user_id full_name email').lean();
  usage.top_users = usage.top_users.map((u) => {
    const p = names.find((x) => x.user_id === u.user_id);
    return { ...u, name: p?.full_name || p?.email || u.user_id };
  });
  return {
    configured: aiConfigured(),
    mock: aiMock(),
    tiers: Object.entries(TIERS).map(([id, t]) => ({ id, label: t.label, description: t.description, enabled: settings.enabled.includes(id) })),
    tasks: Object.entries(TASKS).map(([id, label]) => ({ id, label, tier: settings.tasks[id] })),
    limits,
    usage,
  };
}

export const getAiAdmin = asyncHandler(async (req, res) => {
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  res.json(await overview(days));
});

export const putAiModels = asyncHandler(async (req, res) => {
  const before = await getModelSettings();
  const next = await setModelSettings({ enabled: req.body?.enabled, tasks: req.body?.tasks }, req.userId);
  await audit(req, 'ai.models_updated', { target_type: 'ai_models', details: { before, after: next } });
  res.json(await overview(30));
});

// POST /api/admin/ai/test  { task }: one tiny request through the chosen model, to check the connection
export const testAi = asyncHandler(async (req, res) => {
  const task = Object.keys(TASKS).includes(req.body?.task) ? req.body.task : 'quick';
  if (!aiConfigured()) throw createHttpError(503, 'The AI assistant is not set up yet. Add the service key on the server first.', { code: 'ai_not_configured' });
  if (aiMock()) return res.json({ ok: true, tier: 'mock', ms: 0 });
  const t0 = Date.now();
  try {
    const out = await askText({ task, system: [{ type: 'text', text: 'Reply with the single word: ready' }], messages: [{ role: 'user', content: 'Are you ready?' }], maxTokens: 20 });
    await logUsage(req.userId, 'admin_test', out.usage, out.tier);
    res.json({ ok: true, tier: out.tier, ms: Date.now() - t0 });
  } catch (err) {
    await logFailure(req.userId, 'admin_test', err.tier, err.details?.code);
    throw err;
  }
});
