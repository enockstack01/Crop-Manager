import Anthropic from '@anthropic-ai/sdk';
import createHttpError from '../httpError.js';
import { resolveModel } from './models.js';

/**
 * Model access for every CropManager AI feature. The key is read from the server environment and is never
 * sent to a browser or the mobile app. Which model answers each kind of task is chosen by an administrator
 * (Admin > AI assistant); see models.js.
 *
 *   AI_API_KEY          the service key (the older name ANTHROPIC_API_KEY also works)
 *   AI_DAILY_LIMIT      requests per user per day, default 40 (admins are not limited)
 *   AI_HOURLY_LIMIT     requests per user per hour, default 15
 *   Both limits can be changed from Admin > AI assistant; a per-user daily limit can be set on the
 *   user's page. The environment values are the defaults until an administrator changes them.
 *   AI_MOCK=1           canned answers without calling the service (development and tests only)
 */
const apiKey = () => process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
export const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 40);
export const AI_HOURLY_LIMIT = Number(process.env.AI_HOURLY_LIMIT || 15);

export const aiMock = () => process.env.AI_MOCK === '1' && process.env.NODE_ENV !== 'production';
export const aiConfigured = () => aiMock() || !!apiKey();

let client = null;
function getClient() {
  if (!apiKey()) {
    throw createHttpError(503, 'The AI assistant is not set up yet. Ask your administrator to switch it on.', { code: 'ai_not_configured' });
  }
  if (!client) client = new Anthropic({ apiKey: apiKey(), maxRetries: 2, timeout: 120_000 });
  return client;
}

/** Turns SDK failures into messages a farmer can act on. */
export function friendly(err) {
  if (err?.expose) return err;
  const status = err?.status;
  if (status === 401 || status === 403) return createHttpError(503, 'The AI assistant could not start. Ask your administrator to check its settings.', { code: 'ai_auth' });
  if (status === 404) return createHttpError(503, 'The selected AI model is not available. Ask your administrator to choose another one.', { code: 'ai_model' });
  if (status === 429 || status === 529 || status === 503) return createHttpError(503, 'The AI assistant is busy right now. Please try again in a minute.', { code: 'ai_busy' });
  if (status === 400) return createHttpError(400, 'The AI assistant could not read that request. Try again with a clearer photo or shorter text.', { code: 'ai_bad_request' });
  console.error('[ai]', err?.message || err);
  return createHttpError(502, 'The AI assistant could not answer. Please try again.', { code: 'ai_failed' });
}

/** The app shows plain text: take out markdown symbols the model sometimes adds. */
const clean = (t) => t.replace(/\*\*/g, '').replace(/__/g, '').replace(/^#{1,6}\s*/gm, '').replace(/^\s*[*]\s+/gm, '- ').trim();

const usageOf = (msg) => ({
  input_tokens: msg.usage?.input_tokens || 0,
  output_tokens: msg.usage?.output_tokens || 0,
  cache_read_tokens: msg.usage?.cache_read_input_tokens || 0,
});
const addUsage = (a, b) => ({
  input_tokens: a.input_tokens + b.input_tokens,
  output_tokens: a.output_tokens + b.output_tokens,
  cache_read_tokens: a.cache_read_tokens + b.cache_read_tokens,
});
const ZERO = { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0 };

/**
 * Asks the model to answer through one tool, so the reply is structured JSON that matches
 * `tool.input_schema` instead of text that has to be parsed.
 * `system` is an array of text blocks; a block with cache_control keeps the farm data cached
 * across the several questions a farmer asks in a row.
 */
export async function askTool({ task = 'report', system, messages, tool, maxTokens = 2000 }) {
  const { tier, id } = await resolveModel(task);
  try {
    const msg = await getClient().messages.create({
      model: id, max_tokens: maxTokens, system, messages, tools: [tool], tool_choice: { type: 'tool', name: tool.name },
    });
    const block = msg.content.find((b) => b.type === 'tool_use');
    if (!block) throw new Error('no tool_use block in the reply');
    return { data: block.input, usage: usageOf(msg), tier };
  } catch (err) {
    throw Object.assign(friendly(err), { tier });
  }
}

/** Plain text answer. */
export async function askText({ task = 'chat', system, messages, maxTokens = 1500 }) {
  const { tier, id } = await resolveModel(task);
  try {
    const msg = await getClient().messages.create({ model: id, max_tokens: maxTokens, system, messages });
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!text) throw new Error('empty reply');
    return { text: clean(text), usage: usageOf(msg), tier };
  } catch (err) {
    throw Object.assign(friendly(err), { tier });
  }
}

/**
 * A short working loop: the model may call the given tools (look up farm records, read the weather, run a
 * calculation) several times before it writes its answer. `handlers[name](input)` returns the tool's result.
 */
export async function askAgent({ task = 'chat', system, messages, tools, handlers, maxTokens = 2000, maxRounds = 5 }) {
  const { tier, id } = await resolveModel(task);
  const convo = [...messages];
  let usage = { ...ZERO };
  try {
    for (let round = 0; round < maxRounds; round += 1) {
      const last = round === maxRounds - 1;
      const msg = await getClient().messages.create({
        model: id, max_tokens: maxTokens, system, messages: convo, tools, ...(last ? { tool_choice: { type: 'none' } } : {}),
      });
      usage = addUsage(usage, usageOf(msg));
      const calls = msg.content.filter((b) => b.type === 'tool_use');
      if (!calls.length || msg.stop_reason !== 'tool_use') {
        const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
        if (!text) throw new Error('empty reply');
        return { text: clean(text), usage, tier };
      }
      convo.push({ role: 'assistant', content: msg.content });
      const results = [];
      for (const c of calls) {
        let out;
        try {
          out = await handlers[c.name](c.input || {});
        } catch (e) {
          out = { error: String(e?.message || e).slice(0, 200) };
        }
        results.push({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(out).slice(0, 12000) });
      }
      convo.push({ role: 'user', content: results });
    }
    throw new Error('too many tool rounds');
  } catch (err) {
    throw Object.assign(friendly(err), { tier });
  }
}
