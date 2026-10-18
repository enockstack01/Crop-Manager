import Anthropic from '@anthropic-ai/sdk';
import createHttpError from '../httpError.js';

/**
 * Model access for every CropManager AI feature. Keys and model names are read from the server
 * environment and never sent to a browser or the mobile app; nothing else in the app changes when
 * they are added.
 *
 *   AI_API_KEY          the service key (the older name ANTHROPIC_API_KEY also works)
 *   AI_MODEL            model id (default chosen in this file; ANTHROPIC_MODEL also works)
 *   AI_DAILY_LIMIT      requests per user per day, default 40 (admins are not limited)
 *   AI_HOURLY_LIMIT     requests per user per hour, default 15
 *   Both limits can be changed from Admin > System settings; a per-user daily limit can be set on the
 *   user's page. The environment values are the defaults until an administrator changes them.
 *   AI_MOCK=1           canned answers without calling the service (development and tests only)
 */
const apiKey = () => process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
export const AI_MODEL = process.env.AI_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
export const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 40);
export const AI_HOURLY_LIMIT = Number(process.env.AI_HOURLY_LIMIT || 15);

export const aiMock = () => process.env.AI_MOCK === '1' && process.env.NODE_ENV !== 'production';
export const aiConfigured = () => aiMock() || !!apiKey();

let client = null;
function getClient() {
  if (!apiKey()) {
    throw createHttpError(503, 'The AI assistant is not set up yet. Ask your administrator to switch it on.', { code: 'ai_not_configured' });
  }
  if (!client) client = new Anthropic({ apiKey: apiKey(), maxRetries: 2, timeout: 90_000 });
  return client;
}

/** Turns SDK failures into messages a farmer can act on. */
function friendly(err) {
  const status = err?.status;
  if (status === 401 || status === 403) return createHttpError(503, 'The AI assistant could not start. Ask your administrator to check its settings.', { code: 'ai_auth' });
  if (status === 429 || status === 529 || status === 503) return createHttpError(503, 'The AI assistant is busy right now. Please try again in a minute.', { code: 'ai_busy' });
  if (status === 400) return createHttpError(400, 'The AI assistant could not read that request. Try again with a clearer photo or shorter text.', { code: 'ai_bad_request' });
  console.error('[ai]', err?.message || err);
  return createHttpError(502, 'The AI assistant could not answer. Please try again.', { code: 'ai_failed' });
}

const usageOf = (msg) => ({
  input_tokens: msg.usage?.input_tokens || 0,
  output_tokens: msg.usage?.output_tokens || 0,
  cache_read_tokens: msg.usage?.cache_read_input_tokens || 0,
});

/**
 * Asks the model to answer through one tool, so the reply is structured JSON that matches
 * `tool.input_schema` instead of text that has to be parsed.
 * `system` is an array of text blocks; a block with cache_control keeps the farm data cached
 * across the several questions a farmer asks in a row.
 */
export async function askTool({ system, messages, tool, maxTokens = 2000 }) {
  try {
    const msg = await getClient().messages.create({
      model: AI_MODEL,
      max_tokens: maxTokens,
      system,
      messages,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
    });
    const block = msg.content.find((b) => b.type === 'tool_use');
    if (!block) throw new Error('no tool_use block in the reply');
    return { data: block.input, usage: usageOf(msg) };
  } catch (err) {
    throw err.expose ? err : friendly(err);
  }
}

/** Plain text answer (the farm assistant chat). */
export async function askText({ system, messages, maxTokens = 1500 }) {
  try {
    const msg = await getClient().messages.create({ model: AI_MODEL, max_tokens: maxTokens, system, messages });
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!text) throw new Error('empty reply');
    return { text, usage: usageOf(msg) };
  } catch (err) {
    throw err.expose ? err : friendly(err);
  }
}
