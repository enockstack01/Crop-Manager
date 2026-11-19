import mongoose from 'mongoose';
import createHttpError from '../lib/httpError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { GreenhouseCrop, FruitCount, GreenhouseHouse } from '../models/index.js';
import { MAX_PLANTS, PATTERNS, STATES, rowDefsOf, rowIdFor, plantLabelFor, keyOf, positionsOf, parseRowId, hasPosition, doorOf, totalPositions } from '../lib/greenhouse/layout.js';

/*
 * Greenhouse layouts. The owner says once how a greenhouse is laid out: its size and compass direction, the door, the rows (each with its own
 * number of positions, and optionally two side-by-side sub rows A and B) and how the plants stand (grid, zig-zag, staggered). Every position
 * then has a fixed name, "R3 P7" (row 3, plant 7) or "R3A P7" in a row with sub rows, and the plan, the 3D view and the recording form all use it.
 * A plant position can be frozen (a sick plant that should be left alone) or deactivated (uprooted), always with a reason.
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
export const plantName = (r, p, sub = '') => ({ row_id: rowIdFor(r, sub), plant_label: plantLabelFor(p) });

async function ownHouse(owner, id) {
  if (!mongoose.isValidObjectId(id)) throw createHttpError(404, 'Greenhouse not found');
  const h = await GreenhouseHouse.findOne({ _id: id, user_id: owner });
  if (!h) throw createHttpError(404, 'Greenhouse not found');
  return h;
}

/** The shape of each row from the request: [{ plants, start, sub_rows }]. */
function readRowDefs(list) {
  if (!Array.isArray(list) || list.length < 1 || list.length > 100) throw createHttpError(400, 'Give the rows of the greenhouse as a list of 1 to 100 rows.');
  return list.map((d, i) => ({
    plants: int(d?.plants, 0, 300, `Row ${i + 1}: enter how many plant positions it has, from 0 to 300.`),
    start: int(d?.start ?? 0, 0, 300, `Row ${i + 1}: where it starts must be a whole number from 0 to 300.`),
    sub_rows: d?.sub_rows === 2 || d?.sub_rows === '2' ? 2 : 1,
  }));
}

async function readBody(owner, body, partial = false) {
  const out = {};
  if (!partial || body.name !== undefined) {
    const name = text(body.name, 60);
    if (!name) throw createHttpError(400, 'Give the greenhouse a name, for example House 1.');
    out.name = name;
  }
  if (!partial || body.length_m !== undefined) out.length_m = dim(body.length_m, 1, 500, 'Enter the length of the greenhouse in metres (1 to 500).');
  if (!partial || body.width_m !== undefined) out.width_m = dim(body.width_m, 1, 200, 'Enter the width of the greenhouse in metres (1 to 200).');
  if (body.row_defs !== undefined) {
    out.row_defs = readRowDefs(body.row_defs);
    out.rows = out.row_defs.length;
    out.plants_per_row = Math.max(1, ...out.row_defs.map((d) => d.plants));
  } else {
    if (!partial || body.rows !== undefined) out.rows = int(body.rows, 1, 100, 'Enter the number of rows, from 1 to 100.');
    if (!partial || body.plants_per_row !== undefined) out.plants_per_row = int(body.plants_per_row, 1, 300, 'Enter the number of plants in each row, from 1 to 300.');
  }
  if (body.orientation_deg !== undefined) out.orientation_deg = dim(((Number(body.orientation_deg) % 360) + 360) % 360, 0, 359.99, 'The direction must be a compass bearing from 0 to 359.');
  if (body.door !== undefined) {
    if (body.door === null || body.door === false) out.door = null;
    else {
      const wall = ['top', 'bottom', 'left', 'right'].includes(body.door.wall) ? body.door.wall : null;
      if (!wall) throw createHttpError(400, 'Choose the wall the door is in: top, bottom, left or right.');
      out.door = { wall, position: dim(body.door.position ?? 0.5, 0, 1, 'Where the door is along the wall must be between 0 and 1.'), width_m: dim(body.door.width_m ?? 1.2, 0.5, 10, 'The door width must be 0.5 to 10 metres.') };
    }
  }
  if (body.pattern !== undefined) {
    if (!PATTERNS.includes(body.pattern)) throw createHttpError(400, `Choose how the plants stand: ${PATTERNS.join(', ')}.`);
    out.pattern = body.pattern;
  }
  for (const [key, msg] of [['plant_spacing_m', 'The distance between plants must be 0.05 to 20 metres, or empty to spread them evenly.'], ['row_spacing_m', 'The distance between rows must be 0.1 to 20 metres, or empty to spread them evenly.']]) {
    if (body[key] !== undefined) out[key] = body[key] === null || body[key] === '' ? null : dim(body[key], key === 'row_spacing_m' ? 0.1 : 0.05, 20, msg);
  }
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
    const found = await GreenhouseCrop.countDocuments({ _id: { $in: [...crops] }, user_id: owner });
    if (found !== crops.size) throw createHttpError(400, 'That crop is not one of your greenhouse crops. Add it under My crops first.');
  }
  if (body.notes !== undefined) out.notes = text(body.notes, 500);
  return out;
}

const view = (h) => {
  const o = h.toJSON();
  return { ...o, crop_id: h.crop_id ? String(h.crop_id) : null, row_defs: rowDefsOf(h), door: h.door ? { ...o.door, ...doorOf(h) } : null, positions: undefined, position_log: undefined, total_positions: totalPositions(h) };
};

export const listHouses = asyncHandler(async (req, res) => {
  const houses = await GreenhouseHouse.find({ user_id: req.gh.owner }).sort({ name: 1 });
  res.json({ data: houses.map(view) });
});

export const createHouse = asyncHandler(async (req, res) => {
  const body = await readBody(req.gh.owner, req.body || {});
  const probe = { ...body, row_defs: body.row_defs || [] };
  if (totalPositions(probe) > MAX_PLANTS) throw createHttpError(400, `A greenhouse can hold at most ${MAX_PLANTS} plants in the layout. Split a very large house in two.`);
  if (await GreenhouseHouse.exists({ user_id: req.gh.owner, name: body.name })) throw createHttpError(409, 'You already have a greenhouse with that name.');
  const h = await GreenhouseHouse.create({ ...body, user_id: req.gh.owner });
  res.status(201).json(view(h));
});

export const updateHouse = asyncHandler(async (req, res) => {
  const h = await ownHouse(req.gh.owner, req.params.id);
  const b = await readBody(req.gh.owner, req.body || {}, true);
  const next = { rows: h.rows, plants_per_row: h.plants_per_row, row_defs: h.row_defs, ...b };
  if (b.row_defs === undefined && (b.rows !== undefined || b.plants_per_row !== undefined)) {
    // only the grid size changed: keep the rows it still has, give new rows the new default number of positions
    const old = rowDefsOf(h);
    next.row_defs = Array.from({ length: next.rows }, (_x, i) => (b.plants_per_row === undefined && old[i] ? old[i] : { plants: next.plants_per_row, start: 0, sub_rows: old[i]?.sub_rows || 1 }));
    b.row_defs = next.row_defs;
  }
  if (totalPositions(next) > MAX_PLANTS) throw createHttpError(400, `A greenhouse can hold at most ${MAX_PLANTS} plants in the layout.`);
  if (b.name && b.name !== h.name) {
    if (await GreenhouseHouse.exists({ user_id: req.gh.owner, name: b.name })) throw createHttpError(409, 'You already have a greenhouse with that name.');
    // counts are tied to a greenhouse by its name: they follow the new name
    await FruitCount.updateMany({ user_id: req.gh.owner, greenhouse: h.name }, { $set: { greenhouse: b.name } });
  }
  h.set(b);
  await h.save();
  res.json(view(h));
});

export const removeHouse = asyncHandler(async (req, res) => {
  const h = await ownHouse(req.gh.owner, req.params.id);
  // only the layout goes: the fruit counts stay (they keep the greenhouse name, row and plant)
  await h.deleteOne();
  res.json({ ok: true });
});

/** The short form of a health check for the layout: status, the disease, and how many fruit look sick. */
export const healthOf = (h) => (h && h.status && h.status !== 'not_checked' ? {
  status: h.status, disease: h.plant?.disease || null, sick_fruit: h.sick_fruit || 0, checked_fruit: h.checked_fruit || 0, message: h.message || '',
} : null);

const stateOf = (h, key) => {
  const p = (h.positions && h.positions[key]) || null;
  return { state: p?.state || 'active', state_reason: p?.reason || '', label: p?.label || '' };
};

/** The plants of one greenhouse with the latest count on each, ready to draw. `role` trims what a data collector may see. */
export async function buildLayout(userId, h, { role = 'owner' } = {}) {
  const [counts, crops] = await Promise.all([
    FruitCount.find({ user_id: userId, greenhouse: h.name }).sort({ count_date: -1, created_at: -1 }).lean(),
    GreenhouseCrop.find({ user_id: userId }).lean(),
  ]);
  const cropName = new Map(crops.map((c) => [String(c._id), c.name]));
  const cropKey = new Map(crops.map((c) => [String(c._id), c.catalog_key]));
  const latest = new Map();
  const total = new Map();
  for (const c of counts) {
    const k = keyOf(c.row_id, c.plant_label);
    if (!latest.has(k)) latest.set(k, c);
    total.set(k, (total.get(k) || 0) + 1);
  }
  const plants = [];
  let counted = 0;
  let fruit = 0;
  let sick = 0;
  let frozen = 0;
  let inactive = 0;
  for (const pos of positionsOf(h)) {
    const key = keyOf(pos.row_id, pos.plant_label);
    const cropId = (h.row_crops && h.row_crops[pos.row - 1]) || (h.crop_id ? String(h.crop_id) : '');
    const st = stateOf(h, key);
    const c = latest.get(key);
    if (st.state === 'frozen') frozen += 1;
    if (st.state === 'inactive') inactive += 1;
    if (c && st.state !== 'inactive') {
      counted += 1;
      fruit += c.recorded_count;
      if (c.verification?.health?.status === 'sick') sick += 1;
    }
    plants.push({
      ...pos, ...st,
      crop_id: cropId || null, crop_name: cropName.get(cropId) || null, crop_key: cropKey.get(cropId) || 'custom',
      latest: c ? {
        id: String(c._id), count_date: c.count_date, recorded_count: c.recorded_count, status: c.verification?.status || 'not_checked', label: c.label || '', fruit_size: c.fruit_size || 'all',
        detected: c.verification?.detected ?? null, health: role === 'collector' ? null : healthOf(c.verification?.health), photo_url: c.photo_url, annotated_url: c.annotated_url || null, photos: (c.photo_urls || []).length || 1, records: total.get(key),
      } : null,
    });
  }
  const live = plants.filter((p) => p.state !== 'inactive').length;
  return {
    house: view(h), plants,
    door: doorOf(h),
    summary: {
      plants: plants.length, active: plants.length - frozen - inactive, frozen, inactive, counted, ...(role === 'collector' ? {} : { sick_plants: sick }),
      not_counted: live - counted, fruit, average_per_counted_plant: counted ? Math.round((fruit / counted) * 10) / 10 : 0,
    },
  };
}

export const getLayout = asyncHandler(async (req, res) => {
  res.json(await buildLayout(req.gh.owner, await ownHouse(req.gh.owner, req.params.id), { role: req.gh.role }));
});

/** All counts ever recorded on one plant, newest first. */
export const plantHistory = asyncHandler(async (req, res) => {
  const h = await ownHouse(req.gh.owner, req.params.id);
  const sub = req.query.sub ? String(req.query.sub).toUpperCase() : '';
  const r = int(req.params.row, 1, h.rows, 'That row is not in this greenhouse.');
  const def = rowDefsOf(h)[r - 1];
  const p = int(req.params.plant, 1, def.plants, 'That plant is not in this greenhouse.');
  if ((def.sub_rows === 2) !== !!sub || (sub && !['A', 'B'].includes(sub))) throw createHttpError(400, def.sub_rows === 2 ? 'This row has two sub rows: add ?sub=A or ?sub=B.' : 'This row has no sub rows.');
  const { row_id, plant_label } = plantName(r, p, sub);
  const filter = { user_id: req.gh.owner, greenhouse: h.name, row_id, plant_label };
  if (req.gh.role === 'collector') filter.entered_by = req.gh.actor; // a data collector sees their own entries only
  const rows = await FruitCount.find(filter).sort({ count_date: -1, created_at: -1 }).limit(60).lean();
  const st = stateOf(h, keyOf(row_id, plant_label));
  res.json({ house: h.name, row_id, plant_label, ...st, data: rows.map((x) => ({ ...x, id: String(x._id), _id: undefined, __v: undefined, ...(req.gh.role === 'collector' ? { verification: x.verification ? { ...x.verification, health: undefined } : null } : {}) })) });
});

/* ------------------------------------------------- positions: add, freeze, deactivate */
const logChange = (h, req, entry) => {
  const log = Array.isArray(h.position_log) ? h.position_log : [];
  log.push({ ...entry, by: req.gh.actor, by_name: req.gh.actorName || '', at: new Date().toISOString() });
  h.position_log = log.slice(-300);
};

/**
 * Freezes, deactivates or reactivates one position, or only names it ({ row_id, plant_label, state, reason, label }).
 * Freezing (a sick plant to leave alone) and deactivating (the plant was uprooted) both need a reason; it is kept with who did it and when.
 */
export const setPosition = asyncHandler(async (req, res) => {
  const h = await ownHouse(req.gh.owner, req.params.id);
  const b = req.body || {};
  const rowId = text(b.row_id, 8).toUpperCase();
  const plantLabel = text(b.plant_label, 8).toUpperCase();
  if (!hasPosition(h, rowId, plantLabel)) throw createHttpError(404, 'That plant position is not in this greenhouse.');
  const key = keyOf(rowId, plantLabel);
  const now = (h.positions && h.positions[key]) || {};
  const next = { ...now };
  const stateGiven = b.state !== undefined;
  if (stateGiven) {
    if (!STATES.includes(b.state)) throw createHttpError(400, 'The state must be active, frozen or inactive.');
    const reason = text(b.reason, 300);
    if (b.state !== 'active' && !reason) throw createHttpError(400, b.state === 'frozen' ? 'Say why this plant is frozen, for example a diseased plant that should be left alone.' : 'Say why this position is deactivated, for example the plant was uprooted.');
    next.state = b.state;
    next.reason = reason;
    next.by = req.gh.actor;
    next.by_name = req.gh.actorName || '';
    next.at = new Date().toISOString();
    if (b.state !== (now.state || 'active')) logChange(h, req, { action: b.state === 'active' ? 'reactivated' : b.state, row_id: rowId, plant_label: plantLabel, reason });
  }
  if (b.label !== undefined) next.label = text(b.label, 60);
  if ((next.state || 'active') === 'active' && !next.label) {
    const positions = { ...(h.positions || {}) };
    delete positions[key];
    h.positions = positions;
  } else {
    h.positions = { ...(h.positions || {}), [key]: next };
  }
  h.markModified('positions');
  await h.save();
  res.json({ row_id: rowId, plant_label: plantLabel, ...stateOf(h, key) });
});

/** Adds plant positions to the end of a row ({ row_id: 'R3' or 'R3A', count: 1 }). */
export const addPositions = asyncHandler(async (req, res) => {
  const h = await ownHouse(req.gh.owner, req.params.id);
  const b = req.body || {};
  const r = parseRowId(h, text(b.row_id, 8));
  if (!r) throw createHttpError(404, 'That row is not in this greenhouse.');
  const count = int(b.count ?? 1, 1, 50, 'Add 1 to 50 positions at a time.');
  const defs = rowDefsOf(h);
  const added = r.def.sub_rows === 2 ? count * 2 : count;
  if (totalPositions({ ...h.toObject(), row_defs: defs }) + added > MAX_PLANTS) throw createHttpError(400, `A greenhouse can hold at most ${MAX_PLANTS} plants in the layout.`);
  defs[r.row - 1] = { ...defs[r.row - 1], plants: defs[r.row - 1].plants + count };
  h.row_defs = defs;
  h.plants_per_row = Math.max(h.plants_per_row, ...defs.map((d) => d.plants));
  logChange(h, req, { action: 'added', row_id: rowIdFor(r.row, r.sub), count, reason: text(b.reason, 300) });
  await h.save();
  res.status(201).json({ row_id: text(b.row_id, 8).toUpperCase(), plants_in_row: defs[r.row - 1].plants, added: count });
});

/** The history of freezing, deactivating and adding positions of one greenhouse. */
export const positionLog = asyncHandler(async (req, res) => {
  const h = await ownHouse(req.gh.owner, req.params.id);
  res.json({ data: [...(h.position_log || [])].reverse() });
});

/** The diseased plants of one greenhouse, with every detail: for the farm manager and the owner. */
export const healthReport = asyncHandler(async (req, res) => {
  const h = await ownHouse(req.gh.owner, req.params.id);
  const [counts, crops] = await Promise.all([
    FruitCount.find({ user_id: req.gh.owner, greenhouse: h.name }).sort({ count_date: -1, created_at: -1 }).lean(),
    GreenhouseCrop.find({ user_id: req.gh.owner }).lean(),
  ]);
  const cropName = new Map(crops.map((c) => [String(c._id), c.name]));
  const latest = new Map();
  for (const c of counts) { const k = keyOf(c.row_id, c.plant_label); if (!latest.has(k)) latest.set(k, c); }
  const positions = positionsOf(h);
  const sickPlants = [];
  let counted = 0;
  let sickFruit = 0;
  for (const pos of positions) {
    const key = keyOf(pos.row_id, pos.plant_label);
    const st = stateOf(h, key);
    const c = latest.get(key);
    if (!c || st.state === 'inactive') continue;
    counted += 1;
    const hl = c.verification?.health;
    if (hl?.status !== 'sick') continue;
    sickFruit += hl.sick_fruit || 0;
    sickPlants.push({
      row_id: pos.row_id, plant_label: pos.plant_label, state: st.state, state_reason: st.state_reason, label: st.label, crop_name: cropName.get(String(c.crop_id)) || c.crop_name,
      count_date: c.count_date, disease: hl.plant?.disease || null, disease_confidence: hl.plant?.confidence ?? null, alternatives: hl.plant?.alternatives || [],
      sick_fruit: hl.sick_fruit || 0, checked_fruit: hl.checked_fruit || 0, sick_fruit_numbers: (hl.fruits || []).filter((f) => f.status === 'sick').map((f) => f.index),
      message: hl.message || '', recorded_count: c.recorded_count, photo_url: c.photo_url, annotated_url: c.annotated_url || null, count_id: String(c._id),
    });
  }
  res.json({
    greenhouse: h.name,
    summary: { plants: positions.length, counted, sick_plants: sickPlants.length, sick_fruit: sickFruit, share_of_counted: counted ? Math.round((sickPlants.length / counted) * 1000) / 10 : 0 },
    plants: sickPlants,
  });
});
