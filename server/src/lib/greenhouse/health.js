import fs from 'node:fs';
import sharp from 'sharp';
import { classify, visionEnabled } from '../vision/hfClient.js';
import { labelCropFor } from '../vision/cropMap.js';

/*
 * The health check of a photo, with the same disease classifier (ViT-L) the rest of the app uses.
 *
 *  - Plant level: the whole photo is classified for the crop. This is what the classifier was trained for (it mostly knows leaf diseases),
 *    so it is the main result: healthy, a named disease, or not sure.
 *  - Fruit level: each counted fruit is cut out and classified, but only for crops whose fruit the classifier was trained on
 *    (in the current model: banana, mango, papaya). For the other crops it was trained on leaves only, so a verdict on a single fruit
 *    would be a guess. In that case the result says so instead of marking fruit as sick or healthy.
 */
const LABELS = JSON.parse(fs.readFileSync(new URL('../vision/labels.json', import.meta.url), 'utf8')).labels;
const FRUIT_CROPS = new Set(LABELS.filter((l) => l.part === 'fruit').map((l) => l.crop));
const MAX_FRUIT = 20; // a collage of several photos can hold many fruit
const SICK_AT = 0.6;
const CATALOG_CROP = {
  cherry_tomato: 'Tomato', tomato: 'Tomato', sweet_pepper: 'Bell pepper', hot_pepper: 'Chilli', cucumber: 'Cucumber', eggplant: 'Eggplant',
  strawberry: 'Strawberry', zucchini: 'Zucchini', green_beans: 'Bean', melon: 'Melon',
};

/** The classifier's name for a crop of the farmer's: the built-in ones by key, their own by the name they gave it. */
export const classifierCrop = (crop) => CATALOG_CROP[crop.catalog_key] || labelCropFor(crop.name || '') || '';

/** Runs `fn` over `items` with at most `limit` at a time, keeping the order. The classifier answers one photo in a second or two: one after another, twenty fruit take too long. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

/**
 * One plant, several photos: the classifier was trained on single photos, so each photo of the collage is judged on its own and the answers are
 * combined. The plant is sick when any photo shows a disease (the most certain one is reported, with the photos that show it), healthy only when
 * every photo that could be judged is healthy, and not sure otherwise.
 */
export function combinePlant(perPhoto) {
  const usable = perPhoto.filter((p) => p.status !== 'not_checked');
  if (!usable.length) return { status: 'not_checked' };
  const sick = usable.filter((p) => p.status === 'sick').sort((a, b) => b.confidence - a.confidence);
  const summary = perPhoto.map((p) => ({ photo: p.photo, status: p.status, disease: p.disease || null, confidence: p.confidence ?? null }));
  if (sick.length) {
    const { photo, ...top } = sick[0];
    return { ...top, status: 'sick', photos_with_disease: sick.map((p) => p.photo).sort((a, b) => a - b), per_photo: summary };
  }
  const { photo, ...first } = usable[0];
  if (usable.every((p) => p.status === 'healthy')) return { ...first, confidence: Math.min(...usable.map((p) => p.confidence)), status: 'healthy', disease: null, per_photo: summary };
  const unsure = usable.find((p) => p.status === 'unsure');
  const { photo: _p, ...u } = unsure;
  return { ...u, status: 'unsure', per_photo: summary };
}

/** The photos of a collage, cut out again by the grid it was built on. */
async function cellsOf(bytes, collage) {
  const meta = await sharp(bytes, { failOn: 'none' }).metadata();
  const cw = collage.cell?.w || 640;
  const ch = collage.cell?.h || 480;
  const kx = meta.width / (collage.columns * cw);
  const ky = meta.height / (collage.rows * ch);
  return Promise.all(Array.from({ length: collage.photos }, (_x, i) => sharp(bytes, { failOn: 'none' }).extract({
    left: Math.round((i % collage.columns) * cw * kx), top: Math.round(Math.floor(i / collage.columns) * ch * ky), width: Math.round(cw * kx), height: Math.round(ch * ky),
  }).jpeg({ quality: 92 }).toBuffer()));
}

/** One prediction list into a health result. */
export function readPredictions(res) {
  if (!res || !res.predictions?.length) return { status: 'not_checked' };
  const top = res.predictions[0];
  const base = {
    confidence: Math.round(top.confidence * 100) / 100, part: top.part, family: top.family,
    alternatives: res.predictions.slice(1, 3).filter((p) => !p.healthy).map((p) => ({ disease: p.names?.disease || p.disease, confidence: Math.round(p.confidence * 100) / 100 })),
  };
  if (res.unrecognised || top.confidence < SICK_AT || res.confident === false) return { ...base, status: 'unsure', disease: top.healthy ? null : (top.names?.disease || top.disease) };
  if (top.healthy) return { ...base, status: 'healthy', disease: null };
  return { ...base, status: 'sick', disease: top.names?.disease || top.disease };
}

/**
 * Checks the plant and, where the classifier can judge fruit, every counted fruit.
 * `seen` is what the counter returned (detections with x, y, r in a photo of image_size). Never throws: a failure gives { status: 'not_checked' }.
 */
export async function checkHealth(bytes, seen, crop, collage = null) {
  if (!visionEnabled()) return { status: 'not_checked', reason: 'The disease check is switched off.' };
  const label = classifierCrop(crop);
  try {
    let plant;
    if (collage && collage.photos > 1) {
      const cells = await cellsOf(bytes, collage);
      const per = await pool(cells, 3, async (cell, i) => ({ photo: i + 1, ...readPredictions(await classify(cell, { crop: label })) }));
      plant = combinePlant(per);
    } else {
      plant = readPredictions(await classify(bytes, { crop: label }));
    }
    if (plant.status === 'not_checked') return { status: 'not_checked', reason: 'The disease check could not be reached. Check the photo again later.' };
    const out = { crop: label || null, plant, fruits: null, fruit_note: null, sick_fruit: 0, checked_fruit: 0 };
    const dets = seen?.detections || [];
    if (!dets.length) {
      out.fruit_note = 'No fruit was counted in the photo, so no single fruit was checked.';
    } else if (!FRUIT_CROPS.has(label)) {
      out.fruit_note = 'The disease model was trained on leaves for this crop, so it cannot judge single fruit. The result above is for the plant in the photo.';
    } else {
      const [w, h] = seen.image_size || [0, 0];
      const base = await sharp(bytes, { failOn: 'none' }).rotate().resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true }).toBuffer();
      const meta = await sharp(base).metadata();
      const sx = w ? meta.width / w : 1;
      const sy = h ? meta.height / h : 1;
      const list = (await pool(Array.from({ length: Math.min(dets.length, MAX_FRUIT) }, (_x, i) => i), 4, async (i) => {
        const d = dets[i];
        const pad = d.r * 1.35;
        const left = Math.max(0, Math.round((d.x - pad) * sx));
        const top = Math.max(0, Math.round((d.y - pad) * sy));
        const width = Math.min(meta.width - left, Math.round(pad * 2 * sx));
        const height = Math.min(meta.height - top, Math.round(pad * 2 * sy));
        if (width < 24 || height < 24) return null;
        const piece = await sharp(base).extract({ left, top, width, height }).jpeg({ quality: 90 }).toBuffer();
        const res = await classify(piece, { crop: label, part: 'fruit' }); // fruit classes only: a leaf class on a fruit photo means nothing
        if (res) res.predictions = res.predictions.filter((p) => p.part === 'fruit');
        return { index: i + 1, x: d.x, y: d.y, r: d.r, ...readPredictions(res && res.predictions.length ? res : null) };
      })).filter(Boolean);
      out.fruits = list;
      out.checked_fruit = list.filter((f) => f.status !== 'not_checked').length;
      out.sick_fruit = list.filter((f) => f.status === 'sick').length;
      if (dets.length > MAX_FRUIT) out.fruit_note = `The first ${MAX_FRUIT} of ${dets.length} fruit were checked.`;
    }
    const sick = plant.status === 'sick' || out.sick_fruit > 0;
    const parts = [];
    if (plant.status === 'sick') parts.push(`the plant shows signs of ${String(plant.disease).toLowerCase()}${plant.photos_with_disease ? ` (photo${plant.photos_with_disease.length > 1 ? 's' : ''} ${plant.photos_with_disease.join(', ')})` : ''}`);
    if (out.sick_fruit) parts.push(`${out.sick_fruit} of ${out.checked_fruit} fruit look diseased (numbers ${out.fruits.filter((f) => f.status === 'sick').map((f) => f.index).join(', ')} on the marked photo)`);
    out.status = sick ? 'sick' : plant.status === 'healthy' ? 'healthy' : 'unsure';
    out.message = sick ? `Possible disease: ${parts.join('; ')}.` : plant.status === 'healthy' ? 'No disease found in the photo.' : 'The disease check is not sure about this photo. Take a closer, sharper photo of the leaves or fruit.';
    return out;
  } catch (e) {
    console.warn('[greenhouse] health check failed:', String(e?.message || e).slice(0, 120));
    return { status: 'not_checked', reason: 'The disease check could not be completed.' };
  }
}
