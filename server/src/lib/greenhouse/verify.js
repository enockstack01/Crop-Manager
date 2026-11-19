import crypto from 'node:crypto';
import path from 'node:path';
import createHttpError from '../httpError.js';
import sharp from 'sharp';
import { storage } from '../storage.js';
import { checkHealth } from './health.js';

/**
 * Checks a plant photo against the number of fruit the farmer recorded, using the Python and OpenCV fruit counter (vision-service/).
 *
 *   FRUIT_COUNTER_URL      where the counter runs, e.g. https://counter.example.com   (not set: photos are saved but not checked)
 *   FRUIT_COUNTER_TOKEN    shared secret sent as X-Token, if the counter asks for one
 *
 * The result of a check is one of:
 *   match          the photo shows exactly the recorded number
 *   close          within a small allowance (one fruit up to ten, then ten per cent)
 *   mismatch       the photo clearly shows a different number
 *   inconclusive   the counter itself is not sure (green fruit on green leaves, a blurry or dark photo, a background the colour of the fruit),
 *                  so it neither confirms nor contradicts the record
 *   not_checked    no counter is connected
 *   failed         the counter could not be reached or could not read the photo
 */
export const counterUrl = () => String(process.env.FRUIT_COUNTER_URL || '').replace(/\/$/, '');
export const counterConfigured = () => !!counterUrl();

const MEDIA = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

/** Reads one of the uploaded photos of this farm (taken by the owner or by someone the owner invited); anything else is refused. */
export async function readUserPhoto(userId, url) {
  const file = path.basename(String(url || ''));
  if (![].concat(userId).some((id) => file.startsWith(`${id}-`))) throw createHttpError(400, 'That photo does not belong to your account.');
  if (!MEDIA[path.extname(file).toLowerCase()]) throw createHttpError(400, 'Use a JPG, PNG or WebP photo.');
  const bytes = await storage.get(file);
  if (!bytes) throw createHttpError(404, 'The photo could not be found. Upload it again.');
  return bytes;
}

/** The class the trained fruit model uses for each built-in crop. Own crops have none: they are counted by colour. */
export const YOLO_CLASS = {
  cherry_tomato: 'tomato', tomato: 'tomato', sweet_pepper: 'sweet_pepper', hot_pepper: 'hot_pepper', cucumber: 'cucumber', eggplant: 'eggplant',
  strawberry: 'strawberry', melon: 'melon', // zucchini and green beans have no trained counter: they are counted by colour
};

/** Asks the counter. Resolves its answer, or throws an Error with a `kind` of 'down' or 'unreadable'. */
export async function askCounter(bytes, crop, imgsz = 0) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'photo.jpg');
  form.append('colors', (crop.fruit_colors?.length ? crop.fruit_colors : ['red']).join(','));
  form.append('shape', crop.shape === 'elongated' ? 'elongated' : 'round');
  form.append('contrast', crop.contrast === 'low' ? 'low' : 'high');
  if (YOLO_CLASS[crop.catalog_key]) form.append('crop_class', YOLO_CLASS[crop.catalog_key]);
  if (imgsz) form.append('imgsz', String(Math.min(1600, imgsz))); // a collage of several photos is large
  let res;
  try {
    res = await fetch(`${counterUrl()}/count`, {
      method: 'POST', body: form, signal: AbortSignal.timeout(40_000),
      headers: process.env.FRUIT_COUNTER_TOKEN ? { 'X-Token': process.env.FRUIT_COUNTER_TOKEN } : {},
    });
  } catch (e) {
    throw Object.assign(new Error('The fruit counter could not be reached.'), { kind: 'down', cause: e });
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 400) throw Object.assign(new Error(body.detail || 'The photo could not be read.'), { kind: 'unreadable' });
  if (!res.ok) throw Object.assign(new Error(`The fruit counter answered ${res.status}.`), { kind: 'down' });
  return body;
}

/** Draws a red ring and a cross on each fruit the disease check judged sick, on top of the counter's marked photo. */
async function markSick(jpeg, fruits, size) {
  try {
    const meta = await sharp(jpeg).metadata();
    const k = size?.[0] ? meta.width / size[0] : 1;
    const w = Math.max(3, Math.round(meta.width / 200));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}">${fruits.map((f) => {
      const r = Math.max(10, f.r * k * 1.35);
      const x = f.x * k;
      const y = f.y * k;
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#E53935" stroke-width="${w}" stroke-dasharray="${w * 3} ${w * 2}"/><text x="${x + r * 0.7}" y="${y - r * 0.7}" font-size="${Math.max(16, r * 0.9)}" font-family="sans-serif" font-weight="700" fill="#E53935" stroke="#fff" stroke-width="2">!</text>`;
    }).join('')}</svg>`;
    return await sharp(jpeg).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 85 }).toBuffer();
  } catch { return jpeg; }
}

const REASONS = {
  blurry: 'the photo is blurry',
  too_dark: 'the photo is too dark',
  too_bright: 'the photo is too bright',
  background_matches_fruit: 'the background has the same colour as the fruit',
};

/**
 * Small, medium or large fruit: the fruit the counter found, ordered by size and cut into thirds. Needs at least 3 fruit to tell sizes apart.
 * Returns { count } for the chosen third, or null when there are too few fruit to say.
 */
export function sizeBand(detections, size) {
  if (size === 'all') return { count: detections?.length ?? 0 };
  const r = (detections || []).map((d) => d.r).sort((a, b) => a - b);
  if (r.length < 3) return null;
  const lo = Math.floor(r.length / 3);
  const hi = Math.ceil((2 * r.length) / 3);
  return { count: size === 'small' ? lo : size === 'large' ? r.length - hi : hi - lo };
}

/** The tolerance for "close": one fruit up to ten, then ten per cent. */
export const toleranceFor = (recorded) => (recorded <= 10 ? 1 : Math.ceil(recorded * 0.1));

/** Turns what the counter saw and what the farmer recorded into a verdict and a sentence a farmer can act on. */
export function decide({ detected, recorded, confidence, warnings = [], contrast = 'high' }) {
  const tolerance = toleranceFor(recorded);
  const difference = detected - recorded;
  const why = [...(contrast === 'low' ? ['the fruit is the same colour as the leaves'] : []), ...warnings.map((w) => REASONS[w]).filter(Boolean)];
  const fruit = (n) => `${n} ${n === 1 ? 'fruit' : 'fruits'}`;
  let status;
  if (recorded === 0 && detected === 0) status = 'match';
  else if (confidence === 'low') status = 'inconclusive';
  else if (difference === 0) status = 'match';
  else if (Math.abs(difference) <= tolerance) status = 'close';
  else status = 'mismatch';

  let message;
  if (status === 'match') message = recorded === 0 ? 'The photo shows no fruit, the same as the 0 you recorded.' : `The photo shows ${fruit(detected)}, the same as the ${recorded} you recorded.`;
  else if (status === 'close') message = `The photo shows ${fruit(detected)} and you recorded ${recorded}. That is close, within ${tolerance}. Fruit hidden behind leaves or touching each other can be missed.`;
  else if (status === 'inconclusive') message = `The photo shows about ${fruit(detected)} and you recorded ${recorded}, but the count cannot be relied on${why.length ? ` because ${why.join(' and ')}` : ''}. Retake the photo in daylight, with the fruit facing the camera, or keep your own count.`;
  else if (difference > 0) message = `The photo shows more fruit (${detected}) than you recorded (${recorded}). Count again, or check that the photo shows only this plant.`;
  else message = `The photo shows fewer fruit (${detected}) than you recorded (${recorded}). Some may be hidden behind leaves. Count again, or retake the photo with the fruit in view.`;
  return { status, tolerance, difference, message, reasons: why };
}

/**
 * Runs a full check for one photo. Never throws for problems with the counter: the record is still saved, with a verdict that says what happened.
 * Returns { verification, annotated_url }.
 */
export async function verifyPhoto({ userId, uploaders, photoUrl, crop, recorded, fruitSize = 'all', imgsz = 0, collage = null }) {
  const base = { recorded, detected: null, difference: null, tolerance: toleranceFor(recorded), confidence: null, warnings: [], method: null, checked_at: new Date().toISOString() };
  const bytes = await readUserPhoto(uploaders || userId, photoUrl);
  if (!counterConfigured()) {
    const health = await checkHealth(bytes, null, crop);
    return { verification: { ...base, status: 'not_checked', health, message: 'The photo was saved but not checked: the fruit counter is not connected yet. Ask your administrator to connect it.' }, annotated_url: null };
  }
  let seen;
  try {
    seen = await askCounter(bytes, crop, imgsz);
  } catch (e) {
    const unreadable = e.kind === 'unreadable';
    const health = unreadable ? null : await checkHealth(bytes, null, crop);
    return {
      verification: { ...base, health, status: 'failed', message: unreadable ? `${e.message} Take a clearer photo.` : 'The photo was saved but could not be checked right now. Check it again later.' },
      annotated_url: null,
    };
  }
  const health = await checkHealth(bytes, seen, crop);
  let annotated = null;
  if (seen.annotated_jpeg_b64) {
    let jpeg = Buffer.from(seen.annotated_jpeg_b64, 'base64');
    const sickFruit = (health.fruits || []).filter((f) => f.status === 'sick');
    if (sickFruit.length) jpeg = await markSick(jpeg, sickFruit, seen.image_size); // a red ring on every fruit judged diseased
    const name = `${userId}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}-counted.jpg`; // the user id prefix keeps it theirs; the random part makes it unguessable
    await storage.put(name, jpeg);
    annotated = `/uploads/${name}`;
  }
  let detected = seen.count;
  let confidence = seen.confidence;
  let sizeNote = '';
  if (fruitSize !== 'all') {
    const band = sizeBand(seen.detections, fruitSize);
    if (band) { detected = band.count; sizeNote = ` Sizes are judged by comparing the fruit in the photo, so the ${fruitSize} count is approximate.`; } else { confidence = 'low'; sizeNote = ` There are too few fruit in the photo to tell the ${fruitSize} ones apart.`; }
  }
  const verdict = decide({ detected, recorded, confidence, warnings: seen.warnings || [], contrast: String(seen.method || '').startsWith('yolo') ? 'high' : crop.contrast }); // the trained model sees green fruit: the colour-only caution does not apply to it
  return {
    verification: {
      ...base, status: verdict.status, detected, difference: verdict.difference, tolerance: verdict.tolerance, confidence,
      fruit_size: fruitSize, detected_all_sizes: seen.count, photos: collage?.photos || 1,
      warnings: seen.warnings || [], method: seen.method || 'opencv', message: verdict.message + sizeNote, health,
    },
    annotated_url: annotated,
  };
}
