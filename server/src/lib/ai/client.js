import Anthropic from '@anthropic-ai/sdk';
import createHttpError from '../httpError.js';
import { resolveModel } from './models.js';
import { plainDeep, plainText } from './plainText.js';

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
  if (!client) client = new Anthropic({ apiKey: apiKey(), maxRetries: 1, timeout: 60_000 });
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

/** The apps show plain text: markdown, dashes between words and decorative symbols the model sometimes adds are taken out (plainText.js). */
const clean = plainText;

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
 * Extra request fields per tier. The Fast tier answers with hidden reasoning switched on by default, which
 * spends the output budget before the answer starts and often leaves required fields out of a structured reply
 * (measured: 4 of 8 fields on a season summary). Reasoning is switched off there; the other tiers are unchanged.
 */
const tuning = (tier) => (tier === 'fast' ? { thinking: { type: 'disabled' } } : {});

/**
 * Asks the model to answer through one tool, so the reply is structured JSON that matches
 * `tool.input_schema` instead of text that has to be parsed.
 * `system` is an array of text blocks; a block with cache_control keeps the farm data cached
 * across the several questions a farmer asks in a row.
 */
export async function askTool({ task = 'report', system, messages, tool, maxTokens = 2000 }) {
  const { tier, id } = await resolveModel(task);
  // these models do not accept a forced tool choice: ask for the tool in the prompt and check the reply
  const sys = [...system, { type: 'text', text: `Give your answer only by calling the function ${tool.name}. Do not write any other text.` }];
  try {
    let usage = { ...ZERO };
    let convo = messages;
    const started = Date.now(); // the apps wait 90 s, so no new attempt starts after 45 s
    let hint = ''; // after an incomplete reply: which fields to fill this time
    let partial = null; // the most complete reply so far, used if no attempt is complete
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const system = hint ? [...sys, { type: 'text', text: hint }] : sys;
      const msg = await getClient().messages.create({ model: id, max_tokens: maxTokens, system, messages: convo, tools: [tool], ...tuning(tier) });
      usage = addUsage(usage, usageOf(msg));
      const block = msg.content.find((b) => b.type === 'tool_use' && b.name === tool.name);
      if (block) {
        // a reply that was cut off, or that left out required fields, is asked for once more
        const missing = (tool.input_schema?.required || []).filter((k) => block.input?.[k] === undefined || block.input[k] === '');
        const cut = msg.stop_reason === 'max_tokens';
        if (!cut && !missing.length) return { data: plainDeep(block.input), usage, tier };
        if (!cut && (!partial || missing.length < partial.missing)) partial = { data: block.input, missing: missing.length };
        if (attempt < 2 && Date.now() - started < 45_000) {
          console.warn(`[ai] ${task}: ${cut ? 'reply cut off' : `reply missing ${missing.join(', ')}`}; asking again`);
          hint = cut
            ? 'Your last answer was too long and was cut off. Keep every field short and still fill every required field.'
            : `Your last answer left out required fields: ${missing.join(', ')}. Fill EVERY required field this time, keeping each one short.`;
          continue;
        }
        if (partial) return { data: plainDeep(partial.data), usage, tier };
        if (cut) throw new Error('reply was cut off');
        return { data: plainDeep(block.input), usage, tier };
      }
      if (msg.stop_reason === 'max_tokens') throw new Error('reply was cut off');
      // it answered in words: ask once more for the function call
      convo = [...messages, { role: 'assistant', content: msg.content.length ? msg.content : [{ type: 'text', text: '...' }] }, { role: 'user', content: `Please give that answer by calling the function ${tool.name}.` }];
    }
    throw new Error('no function call in the reply');
  } catch (err) {
    throw Object.assign(friendly(err), { tier });
  }
}

/** Plain text answer. */
export async function askText({ task = 'chat', system, messages, maxTokens = 1500 }) {
  const { tier, id } = await resolveModel(task);
  try {
    const msg = await getClient().messages.create({ model: id, max_tokens: maxTokens, system, messages, ...tuning(tier) });
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!text) throw new Error('empty reply');
    const truncated = msg.stop_reason === 'max_tokens';
    if (truncated) console.warn(`[ai] ${task} reply hit the ${maxTokens}-token limit and was cut off`);
    return { text: clean(text), usage: usageOf(msg), tier, truncated };
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
        model: id, max_tokens: maxTokens, system, messages: convo, tools, ...tuning(tier),
      });
      usage = addUsage(usage, usageOf(msg));
      const calls = msg.content.filter((b) => b.type === 'tool_use');
      if (!calls.length || msg.stop_reason !== 'tool_use') {
        const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
        if (!text) throw new Error('empty reply');
        const truncated = msg.stop_reason === 'max_tokens';
        if (truncated) console.warn(`[ai] ${task} reply hit the ${maxTokens}-token limit and was cut off`);
        return { text: clean(text), usage, tier, truncated };
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
      // on the last round, tell it to stop looking things up and answer
      convo.push({ role: 'user', content: last || round === maxRounds - 2 ? [...results, { type: 'text', text: 'Now write your answer with what you have. Do not look anything else up.' }] : results });
    }
    throw new Error('too many tool rounds');
  } catch (err) {
    throw Object.assign(friendly(err), { tier });
  }
}
