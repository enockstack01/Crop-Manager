import mongoose from 'mongoose';
import createHttpError from '../lib/httpError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { GreenhouseCrop, FruitCount, GreenhouseHouse } from '../models/index.js';

/*
 * Greenhouse layouts. The manager says once how a greenhouse is laid out (size, rows, plants per row); every plant then has a fixed
 * place, named "R3 P7" (row 3, plant 7), and the 3D view and the recording form both use that same place.
 * A fruit count belongs to a plant when it has the same greenhouse name, row ID and plant label.
 */
const text = (v, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v, lo, hi, msg) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) throw createHttpError(400, msg);
  return n;
};
const dim = (v, lo, hi, msg) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) throw createHttpError(400, msg);
  return Math.round(n * 100) / 100;
};
export const plantName = (r, p) => ({ row_id: `R${r}`, plant_label: `P${p}` });
const MAX_PLANTS = 6000;

async function ownHouse(userId, id) {
  if (!mongoose.isValidObjectId(id)) throw createHttpError(404, 'Greenhouse not found');
  const h = await GreenhouseHouse.findOne({ _id: id, user_id: userId });
  if (!h) throw createHttpError(404, 'Greenhouse not found');
  return h;
}

async function readBody(userId, body, partial = false) {
  const out = {};
  if (!partial || body.name !== undefined) {
    const name = text(body.name, 60);
    if (!name) throw createHttpError(400, 'Give the greenhouse a name, for example House 1.');
    out.name = name;
  }
  if (!partial || body.length_m !== undefined) out.length_m = dim(body.length_m, 1, 500, 'Enter the length of the greenhouse in metres (1 to 500).');
  if (!partial || body.width_m !== undefined) out.width_m = dim(body.width_m, 1, 200, 'Enter the width of the greenhouse in metres (1 to 200).');
  if (!partial || body.rows !== undefined) out.rows = int(body.rows, 1, 100, 'Enter the number of rows, from 1 to 100.');
  if (!partial || body.plants_per_row !== undefined) out.plants_per_row = int(body.plants_per_row, 1, 300, 'Enter the number of plants in each row, from 1 to 300.');
  const crops = new Set();
  if (body.crop_id !== undefined) {
    if (body.crop_id) {
      if (!mongoose.isValidObjectId(body.crop_id)) throw createHttpError(400, 'Choose one of your greenhouse crops.');
      crops.add(String(body.crop_id));
    }
    out.crop_id = body.crop_id || null;
  }
  if (body.row_crops !== undefined) {
    if (!Array.isArray(body.row_crops) || body.row_crops.length > 100) throw createHttpError(400, 'The crop of each row must be a list.');
    out.row_crops = body.row_crops.map((c) => (c ? String(c) : ''));
    out.row_crops.forEach((c) => {
      if (c && !mongoose.isValidObjectId(c)) throw createHttpError(400, 'Choose one of your greenhouse crops.');
      if (c) crops.add(c);
    });
  }
  if (crops.size) {
    const found = await GreenhouseCrop.countDocuments({ _id: { $in: [...crops] }, user_id: userId });
    if (found !== crops.size) throw createHttpError(400, 'That crop is not one of your greenhouse crops. Add it under My crops first.');
  }
  if (body.notes !== undefined) out.notes = text(body.notes, 500);
  return out;
}

const view = (h) => ({ ...h.toJSON(), crop_id: h.crop_id ? String(h.crop_id) : null });

export const listHouses = asyncHandler(async (req, res) => {
  const houses = await GreenhouseHouse.find({ user_id: req.userId }).sort({ name: 1 });
  res.json({ data: houses.map(view) });
});

export const createHouse = asyncHandler(async (req, res) => {
  const body = await readBody(req.userId, req.body || {});
  if (body.rows * body.plants_per_row > MAX_PLANTS) throw createHttpError(400, `A greenhouse can hold at most ${MAX_PLANTS} plants in the layout. Split a very large house in two.`);
  if (await GreenhouseHouse.exists({ user_id: req.userId, name: body.name })) throw createHttpError(409, 'You already have a greenhouse with that name.');
  const h = await GreenhouseHouse.create({ ...body, user_id: req.userId });
  res.status(201).json(view(h));
});

export const updateHouse = asyncHandler(async (req, res) => {
  const h = await ownHouse(req.userId, req.params.id);
  const b = await readBody(req.userId, req.body || {}, true);
  if ((b.rows ?? h.rows) * (b.plants_per_row ?? h.plants_per_row) > MAX_PLANTS) throw createHttpError(400, `A greenhouse can hold at most ${MAX_PLANTS} plants in the layout.`);
  if (b.name && b.name !== h.name) {
    if (await GreenhouseHouse.exists({ user_id: req.userId, name: b.name })) throw createHttpError(409, 'You already have a greenhouse with that name.');
    // counts are tied to a greenhouse by its name: they follow the new name
    await FruitCount.updateMany({ user_id: req.userId, greenhouse: h.name }, { $set: { greenhouse: b.name } });
  }
  h.set(b);
  await h.save();
  res.json(view(h));
});

export const removeHouse = asyncHandler(async (req, res) => {
  const h = await ownHouse(req.userId, req.params.id);
  // only the layout goes: the fruit counts stay (they keep the greenhouse name, row and plant)
  await h.deleteOne();
  res.json({ ok: true });
});

/** The plants of one greenhouse with the latest count on each, ready to draw. */
export async function buildLayout(userId, h) {
  const [counts, crops] = await Promise.all([
    FruitCount.find({ user_id: userId, greenhouse: h.name }).sort({ count_date: -1, created_at: -1 }).lean(),
    GreenhouseCrop.find({ user_id: userId }).lean(),
  ]);
  const cropName = new Map(crops.map((c) => [String(c._id), c.name]));
  const latest = new Map();
  const total = new Map();
  for (const c of counts) {
    const k = `${c.row_id}|${c.plant_label}`;
    if (!latest.has(k)) latest.set(k, c);
    total.set(k, (total.get(k) || 0) + 1);
  }
  const rowSpacing = h.width_m / h.rows;
  const plantSpacing = h.length_m / h.plants_per_row;
  const plants = [];
  let counted = 0;
  let fruit = 0;
  for (let r = 1; r <= h.rows; r += 1) {
    const cropId = (h.row_crops && h.row_crops[r - 1]) || (h.crop_id ? String(h.crop_id) : '');
    for (let p = 1; p <= h.plants_per_row; p += 1) {
      const { row_id, plant_label } = plantName(r, p);
      const c = latest.get(`${row_id}|${plant_label}`);
      if (c) {
        counted += 1;
        fruit += c.recorded_count;
      }
      plants.push({
        row: r, plant: p, row_id, plant_label,
        x: Math.round((p - 0.5) * plantSpacing * 100) / 100, z: Math.round((r - 0.5) * rowSpacing * 100) / 100,
        crop_id: cropId || null, crop_name: cropName.get(cropId) || null,
        latest: c ? {
          id: String(c._id), count_date: c.count_date, recorded_count: c.recorded_count, status: c.verification?.status || 'not_checked',
          detected: c.verification?.detected ?? null, photo_url: c.photo_url, annotated_url: c.annotated_url || null, records: total.get(`${row_id}|${plant_label}`),
        } : null,
      });
    }
  }
  return {
    house: view(h), plants,
    summary: { plants: plants.length, counted, not_counted: plants.length - counted, fruit, average_per_counted_plant: counted ? Math.round((fruit / counted) * 10) / 10 : 0 },
  };
}

export const getLayout = asyncHandler(async (req, res) => {
  res.json(await buildLayout(req.userId, await ownHouse(req.userId, req.params.id)));
});

/** All counts ever recorded on one plant, newest first. */
export const plantHistory = asyncHandler(async (req, res) => {
  const h = await ownHouse(req.userId, req.params.id);
  const r = int(req.params.row, 1, h.rows, 'That row is not in this greenhouse.');
  const p = int(req.params.plant, 1, h.plants_per_row, 'That plant is not in this greenhouse.');
  const { row_id, plant_label } = plantName(r, p);
  const rows = await FruitCount.find({ user_id: req.userId, greenhouse: h.name, row_id, plant_label }).sort({ count_date: -1, created_at: -1 }).limit(60).lean();
  res.json({ house: h.name, row_id, plant_label, data: rows.map((x) => ({ ...x, id: String(x._id), _id: undefined, __v: undefined })) });
});
