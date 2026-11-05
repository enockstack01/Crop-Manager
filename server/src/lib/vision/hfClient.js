import fs from 'node:fs';
import sharp from 'sharp';
import { Client } from '@gradio/client';

/*
 * The crop-disease classifier: a private Hugging Face Space (Gradio, endpoint /classify) that returns the
 * three most likely classes of 229 for a leaf photo. This module is the only place that talks to it.
 *
 *  - one shared connection, rebuilt after a failure
 *  - the photo is shrunk to 1024 px first (the model resizes to 384 anyway)
 *  - 25 s timeout and one retry per call; after 3 failed calls in a row the Space is skipped for 60 s
 *  - at most 4 calls at once, so a burst of farmers cannot use up the Space's GPU quota
 *  - classify() never throws: any failure gives null (the caller then lets the AI assistant read the photo alone)
 *
 * The Hugging Face token is read from HF_TOKEN at call time. It is never logged or returned, and neither is the image.
 */
const LABELS = JSON.parse(fs.readFileSync(new URL('./labels.json', import.meta.url), 'utf8')).labels;
const BY_KEY = new Map(LABELS.map((l) => [l.key, l]));
/** the 49 crops the classifier knows, exactly as the Space expects them */
export const LABEL_CROPS = new Set(LABELS.map((l) => l.crop));

const MAX_SIDE = 1024;
const CONCURRENCY = 4;
const QUEUE_WAIT_MS = 5000;
const BREAKER_FAILS = 3;
const BREAKER_MS = 60_000;

const timeoutMs = () => Number(process.env.HF_TIMEOUT_MS) || 25_000;
const enabled = () => process.env.VISION_ENABLED !== '0' && !!process.env.HF_TOKEN && !!process.env.HF_SPACE_ID;
/** Tests only: with AI_MOCK=1, VISION_TEST_STUB=ok answers from a canned result and =down behaves like a Space that is down. */
const stubMode = () => (process.env.AI_MOCK === '1' && process.env.NODE_ENV !== 'production' ? process.env.VISION_TEST_STUB || '' : '');
/** Whether the classifier is switched on (a failure then counts as a fallback; when off, it does not). */
export const visionEnabled = () => (stubMode() ? process.env.VISION_ENABLED !== '0' : enabled());

/* ---- state (module level so every request shares it) ---- */
let conn = null;
let connecting = null;
let fails = 0;
let openUntil = 0;
let running = 0;
const waiting = [];

/** test hooks: replace how the Space is reached and reset the state */
let connectImpl = (space, token) => Client.connect(space, { hf_token: token });
export const __test = {
  setConnect(fn) { connectImpl = fn; },
  reset() { conn = null; connecting = null; fails = 0; openUntil = 0; running = 0; waiting.length = 0; },
  state: () => ({ fails, open: Date.now() < openUntil, running, waiting: waiting.length }),
};

/** One-line failure note: no token, no image, no stack. */
function note(reason) {
  const msg = String(reason?.message || reason || 'unknown').replace(/hf_[A-Za-z0-9]+/g, 'hf_***').replace(/\s+/g, ' ').slice(0, 160);
  console.warn(`[vision] classifier unavailable: ${msg}`);
}

/**
 * The Gradio client can fail in a background step (for example "Connection errored out. fetch failed" while it uploads
 * the photo) that nothing awaits, so the error escapes as an unhandled rejection and Node would stop the whole API.
 * Rejections that come from that library are noted and absorbed (the call then times out and falls back); the
 * connection is dropped so the next call reconnects. Any other unhandled rejection is thrown again, as Node would.
 */
process.on('unhandledRejection', (reason) => {
  if (!String(reason?.stack || '').includes('@gradio/client')) throw reason;
  conn = null;
  note(reason);
});

function acquire() {
  if (running < CONCURRENCY) { running += 1; return Promise.resolve(true); }
  return new Promise((resolve) => {
    const slot = { resolve };
    slot.timer = setTimeout(() => { waiting.splice(waiting.indexOf(slot), 1); resolve(false); }, QUEUE_WAIT_MS);
    waiting.push(slot);
  });
}
function release() {
  const next = waiting.shift();
  if (next) { clearTimeout(next.timer); next.resolve(true); } else running -= 1;
}

function withTimeout(promise, ms) {
  let timer;
  const t = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms); });
  return Promise.race([promise, t]).finally(() => clearTimeout(timer));
}

async function connection() {
  if (conn) return conn;
  connecting ||= connectImpl(process.env.HF_SPACE_ID, process.env.HF_TOKEN)
    .then((c) => { conn = c; return c; })
    .finally(() => { connecting = null; });
  return connecting;
}

/** Keeps only well-formed predictions whose label we know; null when the reply is not usable. */
export function validate(raw) {
  let out = Array.isArray(raw) ? raw[0] : raw;
  if (typeof out === 'string') { try { out = JSON.parse(out); } catch { return null; } }
  if (!out || typeof out !== 'object' || !Array.isArray(out.predictions)) return null;
  const predictions = out.predictions
    .filter((p) => p && typeof p.label === 'string' && BY_KEY.has(p.label) && Number.isFinite(Number(p.confidence)))
    .map((p) => ({ label: p.label, confidence: Math.min(1, Math.max(0, Number(p.confidence))) }))
    .slice(0, 3);
  if (!predictions.length) return null;
  return {
    model_version: typeof out.model_version === 'string' ? out.model_version.slice(0, 60) : '',
    confident: out.confident === true,
    unrecognised: out.unrecognised === true,
    predictions,
  };
}

/** Crop, plant part, disease, family, healthy flag and the names in the user's language for a label key. */
export function describeLabel(key, lang = 'en') {
  const l = BY_KEY.get(key);
  if (!l) return null;
  const n = l.names?.[lang] || l.names?.en || {};
  return {
    crop: l.crop, part: l.part, disease: l.disease, family: l.family, healthy: !!l.healthy,
    names: { crop: n.crop || l.crop, part: n.part || l.part, disease: n.disease || l.disease },
  };
}

async function toJpeg(buf) {
  return sharp(buf, { failOn: 'none' }).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
}

async function callOnce(jpeg, labelCrop) {
  const c = await connection();
  const res = await withTimeout(c.predict('/classify', [new Blob([jpeg], { type: 'image/jpeg' }), labelCrop]), timeoutMs());
  const out = validate(res?.data);
  if (!out) throw new Error('malformed reply from the Space');
  return out;
}

/**
 * Classifies one photo. `crop` is a name from the 49 label crops (see cropMap.js) or '' to rank all classes.
 * Returns { model_version, confident, unrecognised, predictions: [{ label, confidence, crop, part, disease, family, healthy, names }] }, or null.
 */
export async function classify(image, { crop = '', lang = 'en' } = {}) {
  const stub = stubMode();
  if (stub && process.env.VISION_ENABLED !== '0') {
    if (stub === 'down') { note('stubbed: the Space is down'); return null; }
    const picks = LABELS.filter((l) => !LABEL_CROPS.has(crop) || l.crop === crop).slice(0, 3);
    return { model_version: 'stub', confident: stub !== 'unsure', unrecognised: stub === 'unrecognised', predictions: picks.map((l, i) => ({ label: l.key, confidence: [0.91, 0.06, 0.02][i], ...describeLabel(l.key, lang) })) };
  }
  if (!enabled()) return null;
  if (Date.now() < openUntil) return null;
  const labelCrop = LABEL_CROPS.has(crop) ? crop : '';
  if (!(await acquire())) { note('too many classifications at once'); return null; }
  try {
    const jpeg = await toJpeg(image);
    let result = null;
    let lastErr;
    for (let attempt = 0; attempt < 2 && !result; attempt += 1) {
      try {
        result = await callOnce(jpeg, labelCrop);
      } catch (err) {
        lastErr = err;
        conn = null; // reconnect on the retry
      }
    }
    if (!result) {
      fails += 1;
      if (fails >= BREAKER_FAILS) { openUntil = Date.now() + BREAKER_MS; fails = 0; console.warn(`[vision] skipping the Space for ${BREAKER_MS / 1000} s after repeated failures`); }
      note(lastErr);
      return null;
    }
    fails = 0;
    return { ...result, predictions: result.predictions.map((p) => ({ ...p, ...describeLabel(p.label, lang) })) };
  } catch (err) {
    note(err); // the photo could not be read or resized
    return null;
  } finally {
    release();
  }
}
