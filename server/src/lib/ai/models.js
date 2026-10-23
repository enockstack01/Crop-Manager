import { SystemSetting } from '../../models/index.js';
import createHttpError from '../httpError.js';

/*
 * Model tiers the platform can use. Administrators choose among neutral tier names; the real model ids are
 * server-side only and are never sent to a browser or the mobile app. Add or change an id here (or with the
 * AI_MODEL_FAST, AI_MODEL_BALANCED, AI_MODEL_ADVANCED and AI_MODEL_EXPERT environment variables).
 */
export const TIERS = {
  fast: { label: 'Fast', description: 'Quick answers at the lowest cost. Good for short questions and quick records.', id: process.env.AI_MODEL_FAST || 'claude-haiku-5-5' },
  balanced: { label: 'Balanced', description: 'Good quality for everyday advice, plans and reports.', id: process.env.AI_MODEL_BALANCED || process.env.AI_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5' },
  advanced: { label: 'Advanced', description: 'Deeper reasoning for photo diagnosis and hard questions. Slower.', id: process.env.AI_MODEL_ADVANCED || 'claude-opus-5-5' },
  expert: { label: 'Expert', description: 'Highest quality and the slowest. Use for the most demanding work.', id: process.env.AI_MODEL_EXPERT || 'claude-fable-5-1' },
};

/** What the platform asks the model to do, each with its own tier. */
export const TASKS = {
  chat: 'Farm chat and calculator help',
  vision: 'Crop disease detection from photos',
  report: 'Insights, plans, summaries and calculator reports',
  quick: 'Quick records and short answers',
  translate: 'Translating the app into new languages',
};

export const DEFAULT_MODEL_SETTINGS = {
  enabled: ['fast', 'balanced', 'advanced'],
  tasks: { chat: 'balanced', vision: 'advanced', report: 'balanced', quick: 'fast', translate: 'balanced' },
};

const KEY = 'ai_models';
let cached = null;
let cachedAt = 0;

export async function getModelSettings() {
  if (cached && Date.now() - cachedAt < 30_000) return cached;
  const row = await SystemSetting.findOne({ key: KEY }).lean().catch(() => null);
  const v = row?.value || {};
  const enabled = Array.isArray(v.enabled) ? v.enabled.filter((t) => TIERS[t]) : DEFAULT_MODEL_SETTINGS.enabled;
  cached = { enabled: enabled.length ? enabled : DEFAULT_MODEL_SETTINGS.enabled, tasks: { ...DEFAULT_MODEL_SETTINGS.tasks, ...(v.tasks || {}) } };
  cachedAt = Date.now();
  return cached;
}

export async function setModelSettings({ enabled, tasks }, by) {
  const on = [...new Set((enabled || []).filter((t) => TIERS[t]))];
  if (!on.length) throw createHttpError(400, 'Keep at least one model turned on');
  const next = { enabled: on, tasks: { ...DEFAULT_MODEL_SETTINGS.tasks } };
  for (const t of Object.keys(TASKS)) {
    const pick = tasks?.[t];
    if (pick !== undefined) {
      if (!TIERS[pick]) throw createHttpError(400, `Unknown model: ${pick}`);
      if (!on.includes(pick)) throw createHttpError(400, `${TIERS[pick].label} is turned off, so it cannot be used for ${TASKS[t].toLowerCase()}`);
      next.tasks[t] = pick;
    }
  }
  // a task that pointed at a tier that is now off moves to the first tier still on
  for (const t of Object.keys(next.tasks)) if (!on.includes(next.tasks[t])) next.tasks[t] = on[0];
  await SystemSetting.findOneAndUpdate({ key: KEY }, { $set: { value: next, updated_by: by || null } }, { upsert: true });
  cached = null;
  return getModelSettings();
}

/** The tier and the real model id for a task. */
export async function resolveModel(task = 'report') {
  const s = await getModelSettings();
  const wanted = s.tasks[task] || s.tasks.report;
  const tier = s.enabled.includes(wanted) ? wanted : s.enabled[0];
  return { tier, id: TIERS[tier].id };
}
