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
const MAX_FRUIT = 12;
const SICK_AT = 0.6;
const CATALOG_CROP = {
  cherry_tomato: 'Tomato', tomato: 'Tomato', sweet_pepper: 'Bell pepper', hot_pepper: 'Chilli', cucumber: 'Cucumber', eggplant: 'Eggplant',
  strawberry: 'Strawberry', zucchini: 'Zucchini', green_beans: 'Bean',
};

/** The classifier's name for a crop of the farmer's: the built-in ones by key, their own by the name they gave it. */
export const classifierCrop = (crop) => CATALOG_CROP[crop.catalog_key] || labelCropFor(crop.name || '') || '';

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
export async function checkHealth(bytes, seen, crop) {
  if (!visionEnabled()) return { status: 'not_checked', reason: 'The disease check is switched off.' };
  const label = classifierCrop(crop);
  try {
    const plant = readPredictions(await classify(bytes, { crop: label }));
    if (plant.status === 'not_checked') return { status: 'not_checked', reason: 'The disease check could not be reached. Check the photo again later.' };
    const out = { crop: label || null, plant, fruits: null, fruit_note: null, sick_fruit: 0, checked_fruit: 0 };
    const dets = seen?.detections || [];
    if (!dets.length) {
      out.fruit_note = 'No fruit was counted in the photo, so no single fruit was checked.';
    } else if (!FRUIT_CROPS.has(label)) {
      out.fruit_note = 'The disease model was trained on leaves for this crop, so it cannot judge single fruit. The result above is for the plant in the photo.';
    } else {
      const [w, h] = seen.image_size || [0, 0];
      const base = await sharp(bytes, { failOn: 'none' }).rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).toBuffer();
      const meta = await sharp(base).metadata();
      const sx = w ? meta.width / w : 1;
      const sy = h ? meta.height / h : 1;
      const list = [];
      for (let i = 0; i < Math.min(dets.length, MAX_FRUIT); i += 1) {
        const d = dets[i];
        const pad = d.r * 1.35;
        const left = Math.max(0, Math.round((d.x - pad) * sx));
        const top = Math.max(0, Math.round((d.y - pad) * sy));
        const width = Math.min(meta.width - left, Math.round(pad * 2 * sx));
        const height = Math.min(meta.height - top, Math.round(pad * 2 * sy));
        if (width < 24 || height < 24) continue;
        const piece = await sharp(base).extract({ left, top, width, height }).jpeg({ quality: 90 }).toBuffer();
        const res = await classify(piece, { crop: label });
        if (res) res.predictions = res.predictions.filter((p) => p.part === 'fruit');
        list.push({ index: i + 1, x: d.x, y: d.y, r: d.r, ...readPredictions(res && res.predictions.length ? res : null) });
      }
      out.fruits = list;
      out.checked_fruit = list.filter((f) => f.status !== 'not_checked').length;
      out.sick_fruit = list.filter((f) => f.status === 'sick').length;
      if (dets.length > MAX_FRUIT) out.fruit_note = `The first ${MAX_FRUIT} of ${dets.length} fruit were checked.`;
    }
    const sick = plant.status === 'sick' || out.sick_fruit > 0;
    const parts = [];
    if (plant.status === 'sick') parts.push(`the plant shows signs of ${String(plant.disease).toLowerCase()}`);
    if (out.sick_fruit) parts.push(`${out.sick_fruit} of ${out.checked_fruit} fruit look diseased (numbers ${out.fruits.filter((f) => f.status === 'sick').map((f) => f.index).join(', ')} on the marked photo)`);
    out.status = sick ? 'sick' : plant.status === 'healthy' ? 'healthy' : 'unsure';
    out.message = sick ? `Possible disease: ${parts.join('; ')}.` : plant.status === 'healthy' ? 'No disease found in the photo.' : 'The disease check is not sure about this photo. Take a closer, sharper photo of the leaves or fruit.';
    return out;
  } catch (e) {
    console.warn('[greenhouse] health check failed:', String(e?.message || e).slice(0, 120));
    return { status: 'not_checked', reason: 'The disease check could not be completed.' };
  }
}
