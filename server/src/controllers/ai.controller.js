import fs from 'node:fs';
import path from 'node:path';
import createHttpError from '../lib/httpError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { UPLOAD_DIR } from '../routes/uploads.routes.js';
import { CropScoutingRecord } from '../models/index.js';
import { aiConfigured, aiMock, askText, askTool } from '../lib/ai/client.js';
import { assertWithinLimit, logUsage, usageFor } from '../lib/ai/usage.js';
import { buildFarmContext, contextText } from '../lib/ai/farmContext.js';
import {
  ADVICE_TOPICS, ADVICE_TOOL, DIAGNOSE_TOOL, INSIGHTS_TOOL, RECORD_TOOL, SUMMARY_TOOL, mockFor, systemBlocks,
} from '../lib/ai/prompts.js';

const LANGS = ['en', 'fr', 'rw', 'sw'];
/** the language the farmer reads the app in: sent by the app, else the profile, else English */
const langOf = (req) => (LANGS.includes(req.body?.language) ? req.body.language : LANGS.includes(req.profile?.language) ? req.profile.language : 'en');
const clip = (v, n = 1500) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

/** Runs one structured request: limit check, farm snapshot, model call, usage log. */
async function runTool(req, { feature, mock = feature, tool, userText, extraSystem = '', withFarm = true, content, maxTokens }) {
  if (!aiConfigured()) {
    throw createHttpError(503, 'The AI assistant is not set up yet. Ask your administrator to switch it on.', { code: 'ai_not_configured' });
  }
  await assertWithinLimit(req.profile);
  if (aiMock()) {
    await logUsage(req.userId, feature);
    return { data: mockFor(mock), lists: null };
  }
  const lang = langOf(req);
  const { ctx, lists } = withFarm ? await buildFarmContext(req.userId, req.profile) : { ctx: null, lists: null };
  const system = systemBlocks(lang, ctx ? contextText(ctx) : 'FARM DATA: not shared for this request.', extraSystem);
  const { data, usage } = await askTool({
    system,
    tool,
    maxTokens,
    messages: [{ role: 'user', content: content || [{ type: 'text', text: userText }] }],
  });
  await logUsage(req.userId, feature, usage);
  return { data, lists };
}

/* ---------------------------------------------------------------- status */
export const status = asyncHandler(async (req, res) => {
  const u = await usageFor(req.profile);
  res.json({ enabled: aiConfigured(), ...u });
});

/* -------------------------------------------------------------- diagnose */
const MEDIA = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

/** Loads one of the caller's own uploaded photos as an image block; anything else is refused. */
function photoBlock(userId, url) {
  if (!url) return null;
  const file = path.basename(String(url));
  if (!file.startsWith(`${userId}-`)) throw createHttpError(400, 'That photo does not belong to your account.');
  const media = MEDIA[path.extname(file).toLowerCase()];
  if (!media) throw createHttpError(400, 'Use a JPG, PNG, WebP or GIF photo.');
  const full = path.join(UPLOAD_DIR, file);
  if (!fs.existsSync(full)) throw createHttpError(404, 'The photo could not be found. Upload it again.');
  return { type: 'image', source: { type: 'base64', media_type: media, data: fs.readFileSync(full).toString('base64') } };
}

export const diagnose = asyncHandler(async (req, res) => {
  const b = req.body || {};
  let rec = {};
  if (b.scouting_id) {
    rec = (await CropScoutingRecord.findOne({ _id: b.scouting_id, user_id: req.userId }).lean()) || {};
  }
  const photoUrl = b.photo_url || rec.photo_url || null;
  const lines = [
    ['Crop', clip(b.crop, 80)],
    ['Growth stage', clip(b.growth_stage || rec.growth_stage, 80)],
    ['Plant health noted', clip(b.plant_health || rec.plant_health, 40)],
    ['Pests seen', clip(b.pest_observation || rec.pest_observation)],
    ['Disease signs', clip(b.disease_observation || rec.disease_observation)],
    ['Weeds', clip(b.weed_observation || rec.weed_observation)],
    ['Soil', clip(b.soil_observation || rec.soil_observation)],
    ['Moisture', clip(b.moisture_observation || rec.moisture_observation)],
    ['Symptoms in the farmer\'s words', clip(b.symptoms)],
    ['Notes', clip(b.notes || rec.notes)],
    ['Affected area or share of plants', clip(b.affected, 120)],
  ].filter(([, v]) => v);
  const image = photoBlock(req.userId, photoUrl);
  if (!image && !lines.length) throw createHttpError(400, 'Add a photo or describe what you see.');

  const text = `Diagnose this crop problem for the farmer and write the report: cause, treatment, medication and how to give it.\n\n${lines.map(([k, v]) => `${k}: ${v}`).join('\n')}${image ? '\n\nA photo of the affected plant is attached.' : '\n\nNo photo was added, so say how sure you can be.'}`;
  const content = image ? [image, { type: 'text', text }] : [{ type: 'text', text }];
  const { data } = await runTool(req, {
    feature: 'diagnose', tool: DIAGNOSE_TOOL, content, maxTokens: 2500,
    extraSystem: 'Task: crop disease, pest and nutrient diagnosis from a photo and notes. Look at leaf colour, spots, lesions, holes, frass, wilting, growth stage. Prefer the most likely cause for the farm\'s country and season. Be honest about uncertainty.',
  });
  res.json({ report: data, photo_url: photoUrl });
});

/* ---------------------------------------------------------------- insights */
export const insights = asyncHandler(async (req, res) => {
  const { data } = await runTool(req, {
    feature: 'insights', tool: INSIGHTS_TOOL, maxTokens: 2500,
    userText: 'Review this whole farm and tell me what matters most right now: crops that need attention, pests and disease trends from the scouting, stock that is low or expiring, money (costs against sales) and harvests that are close. Give the next best actions.',
    extraSystem: 'Task: season insights. Use only facts in the FARM DATA. Rank by how much money or crop is at risk.',
  });
  res.json({ insights: data });
});

/* ------------------------------------------------------------------ advice */
export const advice = asyncHandler(async (req, res) => {
  const topic = req.body?.topic;
  if (!ADVICE_TOPICS[topic]) throw createHttpError(400, `Topic must be one of: ${Object.keys(ADVICE_TOPICS).join(', ')}`);
  const question = clip(req.body?.question, 600);
  const { data } = await runTool(req, {
    feature: `advice_${topic}`, mock: 'advice', tool: ADVICE_TOOL, maxTokens: 2500,
    userText: `${ADVICE_TOPICS[topic]}${req.body?.crop_cycle_id ? `\nFocus on the crop cycle with id ${String(req.body.crop_cycle_id).slice(0, 40)} if it appears in the FARM DATA.` : ''}${question ? `\nThe farmer also asks: ${question}` : ''}`,
    extraSystem: 'Task: practical farm planning advice. Give amounts for this farm\'s area, not per hectare only.',
  });
  res.json({ advice: data, topic });
});

/* ----------------------------------------------------------- season summary */
export const seasonSummary = asyncHandler(async (req, res) => {
  const scope = clip(req.body?.scope, 200);
  const { data } = await runTool(req, {
    feature: 'summary', tool: SUMMARY_TOOL, maxTokens: 3000,
    userText: `Write a season summary for a bank or lender from the records.${scope ? ` Cover: ${scope}.` : ' Cover the most recent season and any crop cycles in progress.'} Use real numbers only; where a figure is missing say so.`,
    extraSystem: 'Task: lender-ready summary of production, income, costs and risks. Be factual and neutral. Never promise returns.',
  });
  res.json({ summary: data });
});

/* ---------------------------------------------------- natural-language record */
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const findByName = (list, name) => {
  const n = norm(name);
  if (!n) return null;
  return list.find((x) => norm(x.name) === n) || list.find((x) => norm(x.name).includes(n) || n.includes(norm(x.name))) || null;
};

export const parseRecord = asyncHandler(async (req, res) => {
  const text = clip(req.body?.text, 800);
  if (!text) throw createHttpError(400, 'Type or say what you want to record.');
  const out = await runTool(req, {
    feature: 'record', tool: RECORD_TOOL, maxTokens: 800,
    userText: `Farmer says: "${text}"`,
    extraSystem: 'Task: turn what the farmer says into one expense, sale or harvest record. Never guess an amount or quantity the farmer did not say; list it under missing instead.',
  });
  const r = out.data;
  const lists = out.lists || { farms: [], crops: [] };
  const currency = /^[A-Z]{3}$/.test(r.currency || '') ? r.currency : req.profile?.currency || 'USD';
  const farm = findByName(lists.farms, r.farm) || (lists.farms.length === 1 ? lists.farms[0] : null);
  const crop = findByName(lists.crops, r.crop);
  const missing = [...(r.missing || [])];
  let record = null;

  if (r.resource === 'expenses') {
    if (!r.amount) missing.push('amount');
    record = { category: r.category || 'Other', description: r.description || '', amount: r.amount ?? null, expense_date: r.date, supplier: r.supplier || '', currency, farm_id: farm ? String(farm._id) : null };
  } else if (r.resource === 'sales') {
    if (!crop) missing.push('crop');
    if (!r.quantity) missing.push('quantity');
    record = { crop_id: crop ? String(crop._id) : null, quantity: r.quantity ?? null, unit: r.unit || 'kg', unit_price: r.unit_price ?? null, buyer: r.buyer || '', sale_date: r.date, payment_status: r.payment_status || 'Pending', currency, farm_id: farm ? String(farm._id) : null };
  } else if (r.resource === 'harvest-records') {
    if (!crop) missing.push('crop');
    if (!r.quantity) missing.push('quantity');
    record = { crop_id: crop ? String(crop._id) : null, quantity: r.quantity ?? null, unit: r.unit || 'kg', harvest_date: r.date, currency, farm_id: farm ? String(farm._id) : null };
  }
  res.json({ resource: r.resource, summary: r.summary, record, missing: [...new Set(missing)], crop_name: crop?.name || r.crop || null, farm_name: farm?.name || null });
});

/* -------------------------------------------------------------------- chat */
export const chat = asyncHandler(async (req, res) => {
  if (!aiConfigured()) {
    throw createHttpError(503, 'The AI assistant is not set up yet. Ask your administrator to switch it on.', { code: 'ai_not_configured' });
  }
  const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const turns = incoming
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 2000) }));
  if (!turns.length || turns[turns.length - 1].role !== 'user') throw createHttpError(400, 'Ask a question first.');
  await assertWithinLimit(req.profile);
  if (aiMock()) {
    await logUsage(req.userId, 'chat');
    return res.json({ reply: mockFor('chat') });
  }
  const { ctx } = await buildFarmContext(req.userId, req.profile);
  const { text, usage } = await askText({
    system: systemBlocks(langOf(req), contextText(ctx), 'Task: answer the farmer\'s question in a short chat message (under 180 words unless they ask for detail). Ask one short follow-up question only when you truly need it.'),
    messages: turns,
  });
  await logUsage(req.userId, 'chat', usage);
  res.json({ reply: text });
});
