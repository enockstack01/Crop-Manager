import path from 'node:path';
import mongoose from 'mongoose';
import { storage } from '../lib/storage.js';
import createHttpError from '../lib/httpError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { GreenhouseCrop, FruitCount, GreenhouseHouse, GreenhouseMember, Profile } from '../models/index.js';
import { CATALOG, COLOR_NAMES, DEFAULT_FRUIT_WEIGHT_G, catalogEntry } from '../lib/greenhouse/catalog.js';
import { counterConfigured, verifyPhoto, readUserPhoto } from '../lib/greenhouse/verify.js';
import { MAX_PHOTOS, buildCollage, saveCollage, overlapWarnings } from '../lib/greenhouse/collage.js';
import { accessList, uploadersOf } from '../lib/greenhouse/access.js';
import { hasPosition, keyOf } from '../lib/greenhouse/layout.js';
import { estimate, DEFAULT_RISK } from '../lib/greenhouse/revenue.js';

/*
 * The greenhouse tab: which crops the farmer grows, the fruit counts (a photo, a row and the number of fruit on a plant) and the dashboard.
 * Everything is the signed-in farmer's own: every query carries user_id, and a photo must be one the same person uploaded.
 */
const text = (v, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10); // a phone east of UTC is already on the next date
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
  const mine = await GreenhouseCrop.find({ user_id: req.gh.owner }).lean();
  const byKey = new Map(mine.map((c) => [c.catalog_key, c]));
  res.json({
    crops: CATALOG.map((c) => ({ ...c, selected: byKey.has(c.key), crop_id: byKey.has(c.key) ? String(byKey.get(c.key)._id) : null })),
    colors: COLOR_NAMES,
    counter_connected: counterConfigured(),
  });
});

export const listCrops = asyncHandler(async (req, res) => {
  const [crops, counts] = await Promise.all([
    GreenhouseCrop.find({ user_id: req.gh.owner }).sort({ name: 1 }).lean(),
    FruitCount.aggregate([{ $match: { user_id: req.gh.owner } }, { $group: { _id: '$crop_id', n: { $sum: 1 } } }]),
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
    const have = await GreenhouseCrop.findOne({ user_id: req.gh.owner, catalog_key: entry.key });
    if (have) return res.status(200).json(have.toJSON());
    const doc = await GreenhouseCrop.create({ user_id: req.gh.owner, catalog_key: entry.key, name: entry.name, fruit_colors: entry.fruit_colors, shape: entry.shape, contrast: entry.contrast, fruit_weight_g: entry.fruit_weight_g || DEFAULT_FRUIT_WEIGHT_G });
    return res.status(201).json(doc.toJSON());
  }
  const name = text(b.name, 60);
  if (!name) throw createHttpError(400, 'Give the crop a name.');
  const colors = [...new Set((Array.isArray(b.fruit_colors) ? b.fruit_colors : []).map((c) => String(c).toLowerCase()).filter((c) => COLOR_NAMES.includes(c)))];
  if (!colors.length) throw createHttpError(400, `Choose the colour of the fruit: ${COLOR_NAMES.join(', ')}.`);
  if (await GreenhouseCrop.exists({ user_id: req.gh.owner, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })) throw createHttpError(409, 'You already have a crop with that name.');
  const doc = await GreenhouseCrop.create({
    user_id: req.gh.owner, catalog_key: 'custom', name, fruit_colors: colors,
    shape: b.shape === 'elongated' ? 'elongated' : 'round',
    contrast: colors.length === 1 && colors[0] === 'green' ? 'low' : 'high', // green fruit on green leaves cannot be trusted
    notes: text(b.notes, 300),
    ...priceFields(b),
  });
  return res.status(201).json(doc.toJSON());
});

/** The price and the weight of a fruit from a request body; only what was sent. */
function priceFields(b) {
  const out = {};
  if (b.price_per_kg !== undefined) {
    if (b.price_per_kg === null || b.price_per_kg === '') out.price_per_kg = null;
    else {
      const n = Number(b.price_per_kg);
      if (!Number.isFinite(n) || n < 0 || n > 1e9) throw createHttpError(400, 'The price per kilogram must be a number, 0 or more.');
      out.price_per_kg = n;
    }
  }
  if (b.fruit_weight_g !== undefined) {
    const n = Number(b.fruit_weight_g);
    if (!Number.isFinite(n) || n < 0.1 || n > 20000) throw createHttpError(400, 'The weight of one fruit must be between 0.1 and 20000 grams.');
    out.fruit_weight_g = n;
  }
  if (b.currency !== undefined) {
    const c = text(b.currency, 8).toUpperCase();
    if (!c) throw createHttpError(400, 'Give the currency, for example RWF or USD.');
    out.currency = c;
  }
  return out;
}

/** Sets the price per kilogram, the weight of one fruit and the currency of a crop (owner only). */
export const updateCrop = asyncHandler(async (req, res) => {
  const crop = await ownCrop(req.gh.owner, req.params.id);
  const set = priceFields(req.body || {});
  if (!Object.keys(set).length) throw createHttpError(400, 'Send price_per_kg, fruit_weight_g or currency.');
  const doc = await GreenhouseCrop.findOneAndUpdate({ _id: crop._id, user_id: req.gh.owner }, { $set: set }, { new: true });
  res.json(doc.toJSON());
});

/** What the harvest could be worth: counted fruit, the healthy share, the disease loss expected, and the rest of the house projected. */
export const revenue = asyncHandler(async (req, res) => {
  const [houses, crops, counts] = await Promise.all([
    GreenhouseHouse.find({ user_id: req.gh.owner }).lean(),
    GreenhouseCrop.find({ user_id: req.gh.owner }).lean(),
    FruitCount.find({ user_id: req.gh.owner }).sort({ count_date: -1, created_at: -1 }).limit(20000).select('crop_id greenhouse row_id plant_label recorded_count fruit_size verification.health count_date').lean(),
  ]);
  const risk = req.query.risk === undefined ? DEFAULT_RISK : Number(req.query.risk) / 100;
  res.json(estimate({ houses, counts, crops, risk, greenhouse: text(req.query.greenhouse, 80) || null }));
});

export const removeCrop = asyncHandler(async (req, res) => {
  const crop = await ownCrop(req.gh.owner, req.params.id);
  const n = await FruitCount.countDocuments({ user_id: req.gh.owner, crop_id: crop._id });
  if (n) throw createHttpError(409, `This crop has ${n} fruit ${n === 1 ? 'count' : 'counts'}. Delete them first, or keep the crop.`);
  await GreenhouseCrop.deleteOne({ _id: crop._id, user_id: req.gh.owner });
  res.json({ id: String(crop._id), deleted: true });
});

/* --------------------------------------------------------------- counts */
/** The photos of a count: `photo_urls` (up to 12) or the single `photo_url`. */
function photoList(body) {
  const list = Array.isArray(body.photo_urls) ? body.photo_urls : body.photo_url ? [body.photo_url] : [];
  const urls = [...new Set(list.map((u) => text(u, 300)).filter(Boolean))];
  if (urls.length > MAX_PHOTOS) throw createHttpError(400, `Use at most ${MAX_PHOTOS} photos for one plant.`);
  return urls;
}

/** Joins several photos into one collage (a single photo stays as it is). Returns { photo_url, collage, imgsz }. */
async function joinPhotos(req, urls) {
  if (urls.length === 1) return { photo_url: urls[0], collage: null };
  const allowed = await uploadersOf(req.gh.owner);
  const bytes = await Promise.all(urls.map((u) => readUserPhoto(allowed, u)));
  const [overlaps, joined] = await Promise.all([overlapWarnings(bytes), buildCollage(bytes)]);
  const photo_url = await saveCollage(req.gh.owner, joined.jpeg);
  return { photo_url, collage: { photos: urls.length, columns: joined.columns, rows: joined.rows, cell: joined.cell, overlap_warnings: overlaps } };
}

/**
 * Collages and marked photos are made by the server for one count: they go when the count goes or is checked again, so storage does not fill
 * with files nothing points to. The farmer's own photographs are never touched.
 */
async function dropGenerated(owner, urls) {
  for (const u of urls) {
    const name = path.basename(String(u || ''));
    if (name.startsWith(`${owner}-`) && /-(collage|counted)\.jpg$/.test(name)) await storage.remove(name).catch(() => {});
  }
}

/** A position that was deactivated (the plant was uprooted) takes no new counts. */
async function refuseInactive(owner, greenhouse, rowId, plantLabel) {
  if (!greenhouse) return;
  const h = await GreenhouseHouse.findOne({ user_id: owner, name: greenhouse }).lean();
  if (!h) return;
  const r = String(rowId).toUpperCase();
  const pl = String(plantLabel || '').toUpperCase();
  if (hasPosition(h, r, pl) && h.positions?.[keyOf(r, pl)]?.state === 'inactive') throw createHttpError(409, `${r} ${pl} is deactivated: ${h.positions[keyOf(r, pl)].reason}. Reactivate the position first to record on it.`);
}

/** What a role may see of a count: a data collector sees the verdict but not the disease details. */
const forRole = (doc, role) => {
  const o = doc.toJSON ? doc.toJSON() : doc;
  if (role !== 'collector') return o;
  return { ...o, alerts_ack: undefined, client_id: undefined, verification: o.verification ? { ...o.verification, health: undefined } : o.verification };
};

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
  const urls = photoList(body);
  if (!partial || urls.length) {
    if (!urls.length) throw createHttpError(400, 'Add a photo that shows the fruit on the plant.');
    out.photo_urls = urls; // photo_url is set after the photos are joined
    out.photo_url = urls[0];
  }
  if (!partial || body.count_date !== undefined) {
    const d = text(body.count_date, 10) || today();
    if (!isDate(d)) throw createHttpError(400, 'The date must look like 2026-11-17.');
    if (d > tomorrow()) throw createHttpError(400, 'The date cannot be in the future.');
    out.count_date = d;
  }
  if (body.fruit_size !== undefined || !partial) {
    const size = body.fruit_size === undefined || body.fruit_size === '' ? 'all' : String(body.fruit_size);
    if (!['all', 'small', 'medium', 'large'].includes(size)) throw createHttpError(400, 'Choose the size of the fruit: small, medium, large, or all sizes.');
    out.fruit_size = size;
  }
  if (body.recorded_at !== undefined && body.recorded_at !== null && body.recorded_at !== '') {
    const at = new Date(body.recorded_at);
    const now = Date.now();
    if (Number.isNaN(at.getTime()) || at.getTime() > now + 10 * 60000 || at.getTime() < now - 400 * 86400000) throw createHttpError(400, 'recorded_at must be a recent date and time.');
    out.recorded_at = at;
  }
  put('label', text(body.label, 60));
  put('greenhouse', text(body.greenhouse, 60));
  put('plant_label', text(body.plant_label, 40));
  put('notes', text(body.notes, 500));
  return out;
}

const present = (doc, role = 'owner') => forRole(doc, role);

export const listCounts = asyncHandler(async (req, res) => {
  const q = req.query;
  const filter = { user_id: req.gh.owner };
  if (req.gh.role === 'collector') filter.entered_by = req.gh.actor; // a data collector sees what they recorded
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
  res.json({ data: rows.map((r) => ({ ...forRole(r, req.gh.role), id: String(r._id), _id: undefined, __v: undefined })), page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) });
});

export const getCount = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw createHttpError(404, 'Fruit count not found');
  const doc = await FruitCount.findOne({ _id: req.params.id, user_id: req.gh.owner, ...(req.gh.role === 'collector' ? { entered_by: req.gh.actor } : {}) });
  if (!doc) throw createHttpError(404, 'Fruit count not found');
  res.json(present(doc, req.gh.role));
});

/** Runs the check for a count: joins the photos, counts and checks them. Returns what to store. */
async function checkCount(req, { urls, crop, recorded, fruitSize }) {
  const joined = await joinPhotos(req, urls);
  const uploaders = await uploadersOf(req.gh.owner);
  const out = await verifyPhoto({ userId: req.gh.owner, uploaders, photoUrl: joined.photo_url, crop, recorded, fruitSize, collage: joined.collage });
  if (joined.collage) out.verification = { ...out.verification, collage: joined.collage };
  return { ...out, photo_url: joined.photo_url, collage: joined.collage };
}

/** The phone's own id for a count: it lets a count that was sent twice (a reply lost on a bad connection, a retry after being offline) be saved once. */
function readClientId(body) {
  if (body.client_id === undefined || body.client_id === null || body.client_id === '') return null;
  const id = String(body.client_id);
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw createHttpError(400, 'client_id must be 8 to 64 letters, digits, - or _.');
  return id;
}

export const createCount = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const clientId = readClientId(body);
  if (clientId) {
    const again = await FruitCount.findOne({ user_id: req.gh.owner, client_id: clientId });
    if (again) return res.status(200).json(present(again, req.gh.role)); // already saved: send it back, check nothing twice
  }
  const crop = await ownCrop(req.gh.owner, body.crop_id);
  const data = readCount(body);
  await refuseInactive(req.gh.owner, data.greenhouse, data.row_id, data.plant_label);
  const out = await checkCount(req, { urls: data.photo_urls, crop, recorded: data.recorded_count, fruitSize: data.fruit_size });
  let doc;
  try {
    doc = await FruitCount.create({
      user_id: req.gh.owner, crop_id: crop._id, crop_name: crop.name, ...data, photo_url: out.photo_url, collage: out.collage,
      verification: out.verification, annotated_url: out.annotated_url, entered_by: req.gh.actor, entered_by_name: req.gh.actorName, ...(clientId ? { client_id: clientId } : {}),
    });
  } catch (e) {
    if (e?.code === 11000 && clientId) { // the same count arrived twice at once: keep the first
      await dropGenerated(req.gh.owner, [out.annotated_url, out.collage ? out.photo_url : null]);
      return res.status(200).json(present(await FruitCount.findOne({ user_id: req.gh.owner, client_id: clientId }), req.gh.role));
    }
    throw e;
  }
  res.status(201).json(present(doc, req.gh.role));
});

export const updateCount = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw createHttpError(404, 'Fruit count not found');
  const doc = await FruitCount.findOne({ _id: req.params.id, user_id: req.gh.owner, ...(req.gh.role === 'collector' ? { entered_by: req.gh.actor } : {}) });
  if (!doc) throw createHttpError(404, 'Fruit count not found');
  const body = req.body || {};
  let crop = null;
  if (body.crop_id !== undefined && String(body.crop_id) !== String(doc.crop_id)) crop = await ownCrop(req.gh.owner, body.crop_id);
  const data = readCount(body, { partial: true });
  const newPhotos = data.photo_urls && JSON.stringify(data.photo_urls) !== JSON.stringify(doc.photo_urls?.length ? doc.photo_urls : [doc.photo_url]);
  const changed = (data.recorded_count !== undefined && data.recorded_count !== doc.recorded_count) || !!newPhotos || !!crop || (data.fruit_size !== undefined && data.fruit_size !== doc.fruit_size);
  const urls = newPhotos ? data.photo_urls : null;
  delete data.photo_urls;
  delete data.photo_url;
  doc.set(data);
  if (crop) { doc.crop_id = crop._id; doc.crop_name = crop.name; }
  const gone = [];
  if (changed) {
    const use = crop || (await GreenhouseCrop.findOne({ _id: doc.crop_id, user_id: req.gh.owner }).lean());
    if (use) {
      const out = await checkCount(req, { urls: urls || (doc.photo_urls?.length > 1 ? doc.photo_urls : [doc.photo_url]), crop: use, recorded: doc.recorded_count, fruitSize: doc.fruit_size || 'all' });
      gone.push(doc.annotated_url);
      doc.verification = out.verification;
      doc.annotated_url = out.annotated_url;
      if (urls) {
        if (doc.collage) gone.push(doc.photo_url); // the old collage is replaced
        doc.photo_urls = urls; doc.photo_url = out.photo_url; doc.collage = out.collage;
      } else if (out.collage && out.photo_url !== doc.photo_url) {
        gone.push(out.photo_url); // the same photos were joined again for the check: the count keeps its first collage
      }
    }
  }
  await doc.save();
  await dropGenerated(req.gh.owner, gone);
  res.json(present(doc, req.gh.role));
});

/** Checks the same photo again (for example after the counter was connected or improved). */
export const reverify = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw createHttpError(404, 'Fruit count not found');
  const doc = await FruitCount.findOne({ _id: req.params.id, user_id: req.gh.owner });
  if (!doc) throw createHttpError(404, 'Fruit count not found');
  const crop = await GreenhouseCrop.findOne({ _id: doc.crop_id, user_id: req.gh.owner }).lean();
  if (!crop) throw createHttpError(400, 'The crop of this count was removed.');
  const uploaders = await uploadersOf(req.gh.owner);
  const out = await verifyPhoto({ userId: req.gh.owner, uploaders, photoUrl: doc.photo_url, crop, recorded: doc.recorded_count, fruitSize: doc.fruit_size || 'all', collage: doc.collage });
  doc.verification = doc.collage ? { ...out.verification, collage: doc.collage } : out.verification;
  const oldMarked = doc.annotated_url;
  doc.annotated_url = out.annotated_url;
  await doc.save();
  await dropGenerated(req.gh.owner, [oldMarked]);
  res.json(present(doc, req.gh.role));
});

export const removeCount = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw createHttpError(404, 'Fruit count not found');
  const doc = await FruitCount.findOneAndDelete({ _id: req.params.id, user_id: req.gh.owner });
  if (!doc) throw createHttpError(404, 'Fruit count not found');
  await dropGenerated(req.gh.owner, [doc.annotated_url, doc.collage ? doc.photo_url : null]);
  res.json({ id: req.params.id, deleted: true });
});

/** Checks the photos against a number before anything is saved: the form's "Check the photo" button. */
export const checkPhoto = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const crop = await ownCrop(req.gh.owner, body.crop_id);
  const n = Number(body.recorded_count);
  if (body.recorded_count === '' || body.recorded_count === undefined || !Number.isInteger(n) || n < 0 || n > 10000) throw createHttpError(400, 'Enter the number of fruit first, as a whole number.');
  const urls = photoList(body);
  if (!urls.length) throw createHttpError(400, 'Add a photo first.');
  const size = body.fruit_size === undefined || body.fruit_size === '' ? 'all' : String(body.fruit_size);
  if (!['all', 'small', 'medium', 'large'].includes(size)) throw createHttpError(400, 'Choose the size of the fruit: small, medium, large, or all sizes.');
  const out = await checkCount(req, { urls, crop, recorded: n, fruitSize: size });
  const verification = req.gh.role === 'collector' ? { ...out.verification, health: undefined } : out.verification;
  res.json({ verification, annotated_url: out.annotated_url, photo_url: out.photo_url });
});

/* ------------------------------------------------------- who works on this farm */
/** The farms the signed-in person can work on: their own and any they were invited to. Accepts invitations written to their verified address. */
export const access = asyncHandler(async (req, res) => {
  const farms = await accessList(req.userId, req.profile);
  const owners = await Profile.find({ user_id: { $in: farms.map((f) => f.owner_id) } }).select('user_id full_name').lean();
  const name = new Map(owners.map((o) => [o.user_id, o.full_name || 'A farm']));
  res.json({
    own: { owner_id: req.userId, role: 'owner' },
    farms: farms.map((f) => ({ ...f, farm_name: name.get(f.owner_id) || 'A farm' })),
  });
});

export const listTeam = asyncHandler(async (req, res) => {
  const rows = await GreenhouseMember.find({ user_id: req.gh.owner, status: { $ne: 'removed' } }).sort({ created_at: 1 }).lean();
  res.json({ data: rows.map((m) => ({ id: String(m._id), email: m.invited_email, name: m.name, role: m.role, status: m.status })) });
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Invites a person by email as a farm manager or a data collector. They get access when they sign in with that address. */
export const inviteMember = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const email = text(b.email, 160).toLowerCase();
  if (!EMAIL.test(email)) throw createHttpError(400, 'Enter a valid email address.');
  if (!['manager', 'collector'].includes(b.role)) throw createHttpError(400, 'Choose a role: farm manager or data collector.');
  if (email === String(req.profile?.email || '').toLowerCase()) throw createHttpError(400, 'That is your own address.');
  const have = await GreenhouseMember.findOne({ user_id: req.gh.owner, invited_email: email });
  if (have && have.status !== 'removed') throw createHttpError(409, 'That person is already on your team.');
  const doc = have || new GreenhouseMember({ user_id: req.gh.owner, invited_email: email });
  doc.role = b.role;
  doc.name = text(b.name, 80);
  doc.status = 'invited';
  doc.member_id = null;
  await doc.save();
  res.status(201).json({ id: String(doc._id), email, name: doc.name, role: doc.role, status: doc.status });
});

export const changeMember = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw createHttpError(404, 'Team member not found');
  const m = await GreenhouseMember.findOne({ _id: req.params.id, user_id: req.gh.owner, status: { $ne: 'removed' } });
  if (!m) throw createHttpError(404, 'Team member not found');
  if (req.body?.role !== undefined) {
    if (!['manager', 'collector'].includes(req.body.role)) throw createHttpError(400, 'Choose a role: farm manager or data collector.');
    m.role = req.body.role;
  }
  if (req.body?.name !== undefined) m.name = text(req.body.name, 80);
  await m.save();
  res.json({ id: String(m._id), email: m.invited_email, name: m.name, role: m.role, status: m.status });
});

export const removeMember = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw createHttpError(404, 'Team member not found');
  const m = await GreenhouseMember.findOne({ _id: req.params.id, user_id: req.gh.owner, status: { $ne: 'removed' } });
  if (!m) throw createHttpError(404, 'Team member not found');
  m.status = 'removed';
  m.member_id = null;
  await m.save();
  res.json({ id: String(m._id), removed: true });
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
    GreenhouseCrop.find({ user_id: req.gh.owner }).lean(),
    FruitCount.find({ user_id: req.gh.owner, count_date: { $gte: since } }).sort({ count_date: -1, created_at: -1 }).limit(5000).lean(),
    FruitCount.find({ user_id: req.gh.owner, count_date: { $gte: daysAgo(90) } }).sort({ count_date: -1 }).limit(5000).lean(),
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
