import mongoose from 'mongoose';
import createHttpError from '../lib/httpError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { GreenhouseCrop, FruitCount } from '../models/index.js';
import { CATALOG, COLOR_NAMES, catalogEntry } from '../lib/greenhouse/catalog.js';
import { counterConfigured, verifyPhoto } from '../lib/greenhouse/verify.js';

/*
 * The greenhouse tab: which crops the farmer grows, the fruit counts (a photo, a row and the number of fruit on a plant) and the dashboard.
 * Everything is the signed-in farmer's own: every query carries user_id, and a photo must be one the same person uploaded.
 */
const text = (v, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const today = () => new Date().toISOString().slice(0, 10);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/** The farmer's crop, or a 400/404. */
async function ownCrop(userId, id) {
  if (!mongoose.isValidObjectId(id)) throw createHttpError(400, 'Choose one of your greenhouse crops.');
  const crop = await GreenhouseCrop.findOne({ _id: id, user_id: userId }).lean();
  if (!crop) throw createHttpError(400, 'That crop is not one of your greenhouse crops. Add it under My crops first.');
  return crop;
}

/* ---------------------------------------------------------------- crops */
export const catalog = asyncHandler(async (req, res) => {
  const mine = await GreenhouseCrop.find({ user_id: req.userId }).lean();
  const byKey = new Map(mine.map((c) => [c.catalog_key, c]));
  res.json({
    crops: CATALOG.map((c) => ({ ...c, selected: byKey.has(c.key), crop_id: byKey.has(c.key) ? String(byKey.get(c.key)._id) : null })),
    colors: COLOR_NAMES,
    counter_connected: counterConfigured(),
  });
});

export const listCrops = asyncHandler(async (req, res) => {
  const [crops, counts] = await Promise.all([
    GreenhouseCrop.find({ user_id: req.userId }).sort({ name: 1 }).lean(),
    FruitCount.aggregate([{ $match: { user_id: req.userId } }, { $group: { _id: '$crop_id', n: { $sum: 1 } } }]),
  ]);
  const n = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({ data: crops.map((c) => ({ ...c, id: String(c._id), _id: undefined, __v: undefined, counts: n.get(String(c._id)) || 0 })) });
});

/** Adds a crop from the built-in list ({ catalog_key }) or the farmer's own ({ name, fruit_colors, shape?, contrast? }). Adding one twice returns the same crop. */
export const addCrop = asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (b.catalog_key && b.catalog_key !== 'custom') {
    const entry = catalogEntry(b.catalog_key);
    if (!entry) throw createHttpError(400, 'That crop is not in the list.');
    const have = await GreenhouseCrop.findOne({ user_id: req.userId, catalog_key: entry.key });
    if (have) return res.status(200).json(have.toJSON());
    const doc = await GreenhouseCrop.create({ user_id: req.userId, catalog_key: entry.key, name: entry.name, fruit_colors: entry.fruit_colors, shape: entry.shape, contrast: entry.contrast });
    return res.status(201).json(doc.toJSON());
  }
  const name = text(b.name, 60);
  if (!name) throw createHttpError(400, 'Give the crop a name.');
  const colors = [...new Set((Array.isArray(b.fruit_colors) ? b.fruit_colors : []).map((c) => String(c).toLowerCase()).filter((c) => COLOR_NAMES.includes(c)))];
  if (!colors.length) throw createHttpError(400, `Choose the colour of the fruit: ${COLOR_NAMES.join(', ')}.`);
  if (await GreenhouseCrop.exists({ user_id: req.userId, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })) throw createHttpError(409, 'You already have a crop with that name.');
  const doc = await GreenhouseCrop.create({
    user_id: req.userId, catalog_key: 'custom', name, fruit_colors: colors,
    shape: b.shape === 'elongated' ? 'elongated' : 'round',
    contrast: colors.length === 1 && colors[0] === 'green' ? 'low' : 'high', // green fruit on green leaves cannot be trusted
    notes: text(b.notes, 300),
  });
  return res.status(201).json(doc.toJSON());
});

export const removeCrop = asyncHandler(async (req, res) => {
  const crop = await ownCrop(req.userId, req.params.id);
  const n = await FruitCount.countDocuments({ user_id: req.userId, crop_id: crop._id });
  if (n) throw createHttpError(409, `This crop has ${n} fruit ${n === 1 ? 'count' : 'counts'}. Delete them first, or keep the crop.`);
  await GreenhouseCrop.deleteOne({ _id: crop._id, user_id: req.userId });
  res.json({ id: String(crop._id), deleted: true });
});

/* --------------------------------------------------------------- counts */
function readCount(body, { partial = false } = {}) {
  const out = {};
  const put = (key, value) => { if (!partial || body[key] !== undefined) out[key] = value; };
  if (!partial || body.row_id !== undefined) {
    const row = text(body.row_id, 40);
    if (!row) throw createHttpError(400, 'Enter the row ID (for example R3 or Row 12).');
    out.row_id = row;
  }
  if (!partial || body.recorded_count !== undefined) {
    const n = Number(body.recorded_count);
    if (body.recorded_count === '' || body.recorded_count === null || body.recorded_count === undefined || !Number.isInteger(n) || n < 0 || n > 10000) throw createHttpError(400, 'Enter the number of fruit as a whole number, 0 or more.');
    out.recorded_count = n;
  }
  if (!partial || body.photo_url !== undefined) {
    if (!text(body.photo_url, 300)) throw createHttpError(400, 'Add a photo that shows the fruit on the plant.');
    out.photo_url = text(body.photo_url, 300);
  }
  if (!partial || body.count_date !== undefined) {
    const d = text(body.count_date, 10) || today();
    if (!isDate(d)) throw createHttpError(400, 'The date must look like 2026-11-17.');
    if (d > today()) throw createHttpError(400, 'The date cannot be in the future.');
    out.count_date = d;
  }
  put('greenhouse', text(body.greenhouse, 60));
  put('plant_label', text(body.plant_label, 40));
  put('notes', text(body.notes, 500));
  return out;
}

const present = (doc) => {
  const o = doc.toJSON ? doc.toJSON() : doc;
  return o;
};

export const listCounts = asyncHandler(async (req, res) => {
  const q = req.query;
  const filter = { user_id: req.userId };
  if (q.crop_id && mongoose.isValidObjectId(q.crop_id)) filter.crop_id = q.crop_id;
  if (q.row_id) filter.row_id = text(String(q.row_id), 40);
  if (q.greenhouse) filter.greenhouse = text(String(q.greenhouse), 60);
  if (q.status) filter['verification.status'] = text(String(q.status), 20);
  if (isDate(String(q.from || ''))) filter.count_date = { ...(filter.count_date || {}), $gte: q.from };
  if (isDate(String(q.to || ''))) filter.count_date = { ...(filter.count_date || {}), $lte: q.to };
  const perPage = Math.min(100, Math.max(1, Number(q.perPage) || 15));
  const page = Math.max(1, Number(q.page) || 1);
  const [rows, total] = await Promise.all([
    FruitCount.find(filter).sort({ count_date: -1, created_at: -1 }).skip((page - 1) * perPage).limit(perPage).lean(),
    FruitCount.countDocuments(filter),
  ]);
  res.json({ data: rows.map((r) => ({ ...r, id: String(r._id), _id: undefined, __v: undefined })), page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) });
});

export const getCount = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw createHttpError(404, 'Fruit count not found');
  const doc = await FruitCount.findOne({ _id: req.params.id, user_id: req.userId });
  if (!doc) throw createHttpError(404, 'Fruit count not found');
  res.json(present(doc));
});

export const createCount = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const crop = await ownCrop(req.userId, body.crop_id);
  const data = readCount(body);
  const { verification, annotated_url: annotated } = await verifyPhoto({ userId: req.userId, photoUrl: data.photo_url, crop, recorded: data.recorded_count });
  const doc = await FruitCount.create({ user_id: req.userId, crop_id: crop._id, crop_name: crop.name, ...data, verification, annotated_url: annotated });
  res.status(201).json(present(doc));
});

export const updateCount = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw createHttpError(404, 'Fruit count not found');
  const doc = await FruitCount.findOne({ _id: req.params.id, user_id: req.userId });
  if (!doc) throw createHttpError(404, 'Fruit count not found');
  const body = req.body || {};
  let crop = null;
  if (body.crop_id !== undefined && String(body.crop_id) !== String(doc.crop_id)) crop = await ownCrop(req.userId, body.crop_id);
  const data = readCount(body, { partial: true });
  const changed = (data.recorded_count !== undefined && data.recorded_count !== doc.recorded_count) || (data.photo_url !== undefined && data.photo_url !== doc.photo_url) || !!crop;
  doc.set(data);
  if (crop) { doc.crop_id = crop._id; doc.crop_name = crop.name; }
  if (changed) {
    const use = crop || (await GreenhouseCrop.findOne({ _id: doc.crop_id, user_id: req.userId }).lean());
    if (use) {
      const out = await verifyPhoto({ userId: req.userId, photoUrl: doc.photo_url, crop: use, recorded: doc.recorded_count });
      doc.verification = out.verification;
      doc.annotated_url = out.annotated_url;
    }
  }
  await doc.save();
  res.json(present(doc));
});

/** Checks the same photo again (for example after the counter was connected or improved). */
export const reverify = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw createHttpError(404, 'Fruit count not found');
  const doc = await FruitCount.findOne({ _id: req.params.id, user_id: req.userId });
  if (!doc) throw createHttpError(404, 'Fruit count not found');
  const crop = await GreenhouseCrop.findOne({ _id: doc.crop_id, user_id: req.userId }).lean();
  if (!crop) throw createHttpError(400, 'The crop of this count was removed.');
  const out = await verifyPhoto({ userId: req.userId, photoUrl: doc.photo_url, crop, recorded: doc.recorded_count });
  doc.verification = out.verification;
  doc.annotated_url = out.annotated_url;
  await doc.save();
  res.json(present(doc));
});

export const removeCount = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw createHttpError(404, 'Fruit count not found');
  const doc = await FruitCount.findOneAndDelete({ _id: req.params.id, user_id: req.userId });
  if (!doc) throw createHttpError(404, 'Fruit count not found');
  res.json({ id: req.params.id, deleted: true });
});

/** Checks a photo against a number before anything is saved: the form's "Check the photo" button. */
export const checkPhoto = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const crop = await ownCrop(req.userId, body.crop_id);
  const n = Number(body.recorded_count);
  if (body.recorded_count === '' || body.recorded_count === undefined || !Number.isInteger(n) || n < 0 || n > 10000) throw createHttpError(400, 'Enter the number of fruit first, as a whole number.');
  if (!text(body.photo_url, 300)) throw createHttpError(400, 'Add a photo first.');
  const { verification, annotated_url: annotated } = await verifyPhoto({ userId: req.userId, photoUrl: text(body.photo_url, 300), crop, recorded: n });
  res.json({ verification, annotated_url: annotated });
});

/* ------------------------------------------------------------- dashboard */
const weekStart = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Monday
  return d.toISOString().slice(0, 10);
};
const round1 = (n) => Math.round(n * 10) / 10;

export const dashboard = asyncHandler(async (req, res) => {
  const days = Math.min(365, Math.max(7, Number(req.query.days) || 30));
  const since = daysAgo(days);
  const [crops, inWindow, recent] = await Promise.all([
    GreenhouseCrop.find({ user_id: req.userId }).lean(),
    FruitCount.find({ user_id: req.userId, count_date: { $gte: since } }).sort({ count_date: -1, created_at: -1 }).limit(5000).lean(),
    FruitCount.find({ user_id: req.userId, count_date: { $gte: daysAgo(90) } }).sort({ count_date: -1 }).limit(5000).lean(),
  ]);

  // the latest count of each plant: records without a plant label are each their own plant
  const latest = new Map();
  for (const r of inWindow) {
    const key = r.plant_label ? `${r.crop_id}|${r.greenhouse}|${r.row_id}|${r.plant_label}` : String(r._id);
    if (!latest.has(key)) latest.set(key, r); // the list is newest first
  }
  const plants = [...latest.values()];
  const sum = (a) => a.reduce((s, r) => s + r.recorded_count, 0);

  const verdicts = { match: 0, close: 0, mismatch: 0, inconclusive: 0, not_checked: 0, failed: 0 };
  for (const r of inWindow) verdicts[r.verification?.status || 'not_checked'] += 1;
  const decided = verdicts.match + verdicts.close + verdicts.mismatch;

  const group = (rows, keyOf, label) => {
    const m = new Map();
    for (const r of rows) {
      const k = keyOf(r);
      const g = m.get(k) || { ...label(r), plants: 0, fruit: 0 };
      g.plants += 1;
      g.fruit += r.recorded_count;
      m.set(k, g);
    }
    return [...m.values()].map((g) => ({ ...g, avg_per_plant: round1(g.fruit / g.plants) }));
  };
  const byCrop = group(plants, (r) => String(r.crop_id), (r) => ({ crop_id: String(r.crop_id), name: r.crop_name })).sort((a, b) => b.fruit - a.fruit);
  const byRow = group(plants, (r) => `${r.crop_id}|${r.greenhouse}|${r.row_id}`, (r) => ({ crop_name: r.crop_name, greenhouse: r.greenhouse, row_id: r.row_id })).sort((a, b) => b.avg_per_plant - a.avg_per_plant).slice(0, 12);

  // average fruit per counted plant, week by week (the last 8 weeks)
  const weeks = [];
  for (let i = 7; i >= 0; i -= 1) weeks.push(weekStart(daysAgo(i * 7)));
  const weekly = weeks.map((w) => {
    const rows = recent.filter((r) => weekStart(r.count_date) === w);
    return { week: w, counts: rows.length, avg_per_plant: rows.length ? round1(sum(rows) / rows.length) : 0 };
  });

  const alerts = {
    mismatches: recent.filter((r) => r.verification?.status === 'mismatch' && r.count_date >= daysAgo(14)).slice(0, 8).map((r) => ({
      id: String(r._id), crop_name: r.crop_name, greenhouse: r.greenhouse, row_id: r.row_id, plant_label: r.plant_label, count_date: r.count_date,
      recorded: r.recorded_count, detected: r.verification?.detected ?? null,
    })),
    // rows that were counted in the last 90 days but not in the last 7
    stale_rows: (() => {
      const rows = new Map();
      for (const r of recent) {
        const k = `${r.crop_id}|${r.greenhouse}|${r.row_id}`;
        if (!rows.has(k)) rows.set(k, { crop_name: r.crop_name, greenhouse: r.greenhouse, row_id: r.row_id, last_count: r.count_date });
      }
      return [...rows.values()].filter((r) => r.last_count < daysAgo(7)).sort((a, b) => (a.last_count < b.last_count ? -1 : 1)).slice(0, 8);
    })(),
  };

  res.json({
    days,
    counter_connected: counterConfigured(),
    crops: crops.length,
    totals: {
      counts: inWindow.length, plants: plants.length, fruit: sum(plants),
      avg_per_plant: plants.length ? round1(sum(plants) / plants.length) : 0,
      verified_rate: decided ? Math.round(((verdicts.match + verdicts.close) / decided) * 100) : null,
    },
    verdicts,
    by_crop: byCrop,
    by_row: byRow,
    weekly,
    alerts,
    tolerance_note: 'A count is close when it is within one fruit (up to 10 fruit), then within 10 per cent.',
    generated_at: new Date().toISOString(),
  });
});
