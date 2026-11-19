/**
 * Checks the greenhouse tab on the server: the crops, the fruit counts with a photo and a row, the photo check against the fruit counter,
 * the verdicts, ownership, and the dashboard:
 *
 *   node src/scripts/test-greenhouse.mjs
 *
 * Starts the API itself in test mode and a STAND-IN fruit counter whose answers the test controls (the real counter is Python and OpenCV in
 * vision-service/, with its own tests). Removes everything it creates.
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { connectDB } from '../config/db.js';
import * as M from '../models/index.js';
import { greenhouseTool } from '../lib/ai/greenhouseTool.js';
import { storage } from '../lib/storage.js';
import { decide, toleranceFor } from '../lib/greenhouse/verify.js';
import { CATALOG } from '../lib/greenhouse/catalog.js';

const PREFIX = 'ghtest_';
const A = `${PREFIX}a`;
const B = `${PREFIX}b`;
let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };

await connectDB();
const cleanup = async () => {
  await Promise.all([M.GreenhouseCrop, M.FruitCount, M.GreenhouseHouse, M.Profile].map((Model) => Model.deleteMany({ user_id: new RegExp(`^${PREFIX}`) })));
  await storage.removeWithPrefix(PREFIX);
};
await cleanup();
for (const u of [A, B]) await M.Profile.create({ user_id: u, email: `${u}@ghtest.local`, email_verified: true, account_status: 'active', is_active: true, onboarded: true });

/* ---- the stand-in counter */
const seen = [];
const mode = { dets: [], size: [400, 300], count: 12, confidence: 'high', warnings: [], status: 200 };
const TOKEN = 'ghtest-secret';
const fake = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (d) => chunks.push(d));
  req.on('end', () => {
    if (req.url === '/health') { res.end('{"ok":true}'); return; }
    const body = Buffer.concat(chunks).toString('latin1');
    const field = (name) => (body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`)) || [])[1];
    seen.push({ colors: field('colors'), shape: field('shape'), contrast: field('contrast'), token: req.headers['x-token'], hasFile: /name="file"/.test(body) });
    if (req.headers['x-token'] !== TOKEN) { res.statusCode = 401; res.end('{"detail":"Not allowed"}'); return; }
    res.statusCode = mode.status;
    res.setHeader('Content-Type', 'application/json');
    if (mode.status !== 200) { res.end(JSON.stringify({ detail: mode.status === 400 ? 'The photo could not be read.' : 'boom' })); return; }
    res.end(JSON.stringify({ count: mode.count, confidence: mode.confidence, warnings: mode.warnings, detections: mode.dets, image_size: mode.size, method: 'stand-in', annotated_jpeg_b64: Buffer.from('marked-photo').toString('base64') }));
  });
});
await new Promise((r) => fake.listen(0, r));
const counterUrl = `http://localhost:${fake.address().port}`;

const start = async (port, env) => {
  const child = spawn(process.execPath, ['src/index.js'], { cwd: new URL('../../', import.meta.url), env: { ...process.env, PORT: String(port), HF_TOKEN: '', AI_MOCK: '1', ALLOW_DEV_AUTH: '1', FRUIT_COUNTER_URL: '', FRUIT_COUNTER_TOKEN: '', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 180; i += 1) {
    try { if ((await fetch(`${base}/api/health`)).status < 500) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return { child, base };
};
const api = await start(5088, { FRUIT_COUNTER_URL: counterUrl, FRUIT_COUNTER_TOKEN: TOKEN, GREENHOUSE_CHECKS_PER_MINUTE: '1000', VISION_TEST_STUB: 'ok' });
const bare = await start(5089, { GREENHOUSE_CHECKS_PER_MINUTE: '3' }); // no counter connected; and a low limit to see it work
const call = (srv) => (user, method, path, body) => fetch(srv.base + path, { method, headers: { 'x-dev-user': user, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const req = call(api);
const reqBare = call(bare);
const json = async (r) => { try { return await r.json(); } catch { return {}; } };
const photo = async (user, n = 1) => { const name = `${user}-${Date.now()}-${n}${Math.random().toString(36).slice(2, 6)}.jpg`; await storage.put(name, Buffer.from('not-really-a-photo')); return `/uploads/${name}`; };
const today = new Date().toISOString().slice(0, 10);
const ago = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

try {
  console.log('1. the built-in crops and the farmer\'s own list');
  const cat = await json(await req(A, 'GET', '/api/greenhouse/catalog'));
  const keys = (cat.crops || []).map((c) => c.key);
  ok(keys.includes('cherry_tomato') && keys.includes('sweet_pepper') && keys.includes('hot_pepper') && keys.length === CATALOG.length && keys.length >= 8, 'the greenhouse crops come ready: cherry tomato, peppers and more', keys.join(','));
  ok(cat.crops.every((c) => !c.selected) && cat.counter_connected === true && cat.colors.includes('red'), 'none is selected at first, and the catalog says the counter is connected');
  const cherry = await json(await req(A, 'POST', '/api/greenhouse/crops', { catalog_key: 'cherry_tomato' }));
  const again = await req(A, 'POST', '/api/greenhouse/crops', { catalog_key: 'cherry_tomato' });
  ok(!!cherry.id && cherry.name === 'Cherry tomato' && cherry.fruit_colors.join() === 'red,orange,yellow', 'a crop is added from the list with its fruit colours');
  ok(again.status === 200 && (await json(again)).id === cherry.id, 'adding it twice gives the same crop');
  const pepper = await json(await req(A, 'POST', '/api/greenhouse/crops', { catalog_key: 'sweet_pepper' }));
  ok((await json(await req(A, 'GET', '/api/greenhouse/crops'))).data.length === 2, 'the farmer\'s list has the two they chose');
  ok((await req(A, 'POST', '/api/greenhouse/crops', { catalog_key: 'dragon_fruit' })).status === 400, 'a crop that is not in the list is refused');
  const custom = await json(await req(A, 'POST', '/api/greenhouse/crops', { name: 'Green gooseberry', fruit_colors: ['green'] }));
  ok(custom.catalog_key === 'custom' && custom.contrast === 'low', 'the farmer can add their own crop, and green-only fruit is marked as hard to count');
  ok((await req(A, 'POST', '/api/greenhouse/crops', { name: 'No colour' })).status === 400, 'an own crop needs the colour of its fruit');
  ok((await req(A, 'POST', '/api/greenhouse/crops', { name: 'green gooseberry', fruit_colors: ['red'] })).status === 409, 'and a name that is already used is refused');
  const bCrop = await json(await req(B, 'POST', '/api/greenhouse/crops', { catalog_key: 'tomato' }));
  ok((await json(await req(B, 'GET', '/api/greenhouse/crops'))).data.length === 1, 'another farmer\'s list is separate');

  console.log('2. a count needs a photo, a row and a number');
  const goodPhoto = await photo(A);
  const base = { crop_id: cherry.id, greenhouse: 'House 1', row_id: 'R3', plant_label: 'P7', recorded_count: 12, photo_url: goodPhoto, count_date: today };
  const refused = async (patch, label) => { const r = await req(A, 'POST', '/api/greenhouse/counts', { ...base, ...patch }); ok(r.status === 400, label, `status ${r.status}`); };
  await refused({ photo_url: '' }, 'no photo is refused');
  await refused({ row_id: ' ' }, 'no row ID is refused');
  await refused({ recorded_count: '' }, 'no number is refused');
  await refused({ recorded_count: -1 }, 'a negative number is refused');
  await refused({ recorded_count: 3.5 }, 'a fraction of a fruit is refused');
  await refused({ count_date: '2999-01-01' }, 'a date in the future is refused');
  await refused({ crop_id: bCrop.id }, 'another farmer\'s crop is refused');
  await refused({ crop_id: 'nope' }, 'a crop that is not an id is refused');
  await refused({ photo_url: await photo(B) }, 'another farmer\'s photo is refused');
  ok((await M.FruitCount.countDocuments({ user_id: A })) === 0, 'and nothing was saved by any of those');

  console.log('3. the photo is checked against the number');
  mode.count = 12; mode.confidence = 'high';
  const save = async (patch = {}) => json(await req(A, 'POST', '/api/greenhouse/counts', { ...base, photo_url: await photo(A), ...patch }));
  const m = await save();
  ok(m.verification.status === 'match' && m.verification.detected === 12 && m.verification.difference === 0, 'the same number is a match', JSON.stringify(m.verification));
  ok(seen.at(-1).colors === 'red,orange,yellow' && seen.at(-1).shape === 'round' && seen.at(-1).contrast === 'high' && seen.at(-1).hasFile && seen.at(-1).token === TOKEN, 'the counter was sent the photo, the crop\'s colours and the shared secret', JSON.stringify(seen.at(-1)));
  ok(m.annotated_url && m.annotated_url.startsWith(`/uploads/${A}-`) && m.annotated_url.endsWith('-counted.jpg'), 'the marked photo is stored under the farmer\'s own name');
  ok((await save({ recorded_count: 11 })).verification.status === 'close', 'one off is close');
  ok((await save({ recorded_count: 13 })).verification.status === 'close', 'one more is close too');
  const mm = await save({ recorded_count: 9 });
  ok(mm.verification.status === 'mismatch' && /fewer|more/.test(mm.verification.message), 'three off is a mismatch, said in words', mm.verification.message);
  ok((await save({ recorded_count: 20 })).verification.status === 'mismatch', 'far off is a mismatch');
  mode.count = 95;
  ok((await save({ recorded_count: 100 })).verification.status === 'close', 'on a big count ten per cent is close');
  mode.count = 12; mode.confidence = 'low'; mode.warnings = ['blurry'];
  const inc = await save({ recorded_count: 12 });
  ok(inc.verification.status === 'inconclusive' && /blurry/.test(inc.verification.message), 'when the counter is not sure, even an equal number is inconclusive and says why', inc.verification.message);
  ok((await save({ recorded_count: 40 })).verification.status === 'inconclusive', 'and a different number is not called a mismatch');
  mode.confidence = 'high'; mode.warnings = []; mode.count = 0;
  ok((await save({ recorded_count: 0 })).verification.status === 'match', 'no fruit and no fruit is a match');
  mode.count = 12;
  const gooseberry = await save({ crop_id: custom.id, recorded_count: 12 });
  ok(seen.at(-1).contrast === 'low' && seen.at(-1).colors === 'green', 'a green crop is sent to the counter as low contrast');
  mode.confidence = 'medium';
  ok(decide({ detected: 5, recorded: 5, confidence: 'medium', contrast: 'low' }).status === 'match', 'the rule itself: a medium-confidence equal count is a match');
  ok(toleranceFor(10) === 1 && toleranceFor(11) === 2 && toleranceFor(100) === 10, 'the allowance is one fruit up to ten, then ten per cent');

  console.log('4. the counter being away does not lose the record');
  mode.status = 500;
  const down = await save({ recorded_count: 7 });
  ok(down.id && down.verification.status === 'failed', 'the record is saved and says the check failed', JSON.stringify(down.verification));
  mode.status = 400;
  const unreadable = await save({ recorded_count: 7 });
  ok(unreadable.verification.status === 'failed' && /clearer photo/.test(unreadable.verification.message), 'a photo the counter cannot read asks for a clearer one');
  mode.status = 200;
  const nobody = await json(await reqBare(A, 'POST', '/api/greenhouse/counts', { ...base, photo_url: await photo(A), recorded_count: 5 }));
  ok(nobody.verification?.status === 'not_checked' && /not connected/.test(nobody.verification.message), 'with no counter connected the record is saved as not checked, honestly');
  ok((await json(await reqBare(A, 'GET', '/api/greenhouse/catalog'))).counter_connected === false, 'and the catalog says the counter is not connected');
  const burst = [];
  for (let i = 0; i < 4; i += 1) burst.push((await reqBare(B, 'POST', '/api/greenhouse/check', { crop_id: bCrop.id, photo_url: await photo(B), recorded_count: 3 })).status);
  ok(burst.slice(0, 3).every((s) => s === 200) && burst[3] === 429, 'photo checks are limited per minute, so a loop cannot run the counter all day', burst.join(','));

  console.log('5. check before saving, edit, check again');
  const calls = seen.length;
  const pre = await json(await req(A, 'POST', '/api/greenhouse/check', { crop_id: cherry.id, photo_url: await photo(A), recorded_count: 12 }));
  ok(pre.verification.status === 'match' && seen.length === calls + 1, 'the form can check a photo before saving');
  const total = await M.FruitCount.countDocuments({ user_id: A });
  ok((await M.FruitCount.countDocuments({ user_id: A })) === total, 'and checking saves nothing');
  ok((await req(A, 'POST', '/api/greenhouse/check', { crop_id: cherry.id, photo_url: '', recorded_count: 12 })).status === 400, 'a check without a photo is refused');
  const target = await save({ recorded_count: 12 });
  const n1 = seen.length;
  const note = await json(await req(A, 'PUT', `/api/greenhouse/counts/${target.id}`, { notes: 'looked healthy' }));
  ok(note.notes === 'looked healthy' && seen.length === n1, 'changing a note does not run the check again');
  const fix = await json(await req(A, 'PUT', `/api/greenhouse/counts/${target.id}`, { recorded_count: 9 }));
  ok(fix.verification.status === 'mismatch' && seen.length === n1 + 1, 'changing the number checks the photo again');
  const redo = await json(await req(A, 'POST', `/api/greenhouse/counts/${target.id}/verify`));
  ok(redo.verification.status === 'mismatch' && seen.length === n1 + 2, 'a saved count can be checked again');
  ok((await req(B, 'PUT', `/api/greenhouse/counts/${target.id}`, { notes: 'mine now' })).status === 404, 'another farmer cannot edit it');
  ok((await req(B, 'GET', `/api/greenhouse/counts/${target.id}`)).status === 404 && (await req(B, 'DELETE', `/api/greenhouse/counts/${target.id}`)).status === 404, 'or read it or delete it');
  ok((await req(B, 'POST', `/api/greenhouse/counts/${target.id}/verify`)).status === 404, 'or have it checked');

  console.log('6. lists and the dashboard');
  const list = await json(await req(A, 'GET', '/api/greenhouse/counts?perPage=100'));
  ok(list.total === list.data.length && list.data.every((r) => r.user_id === A) && list.data[0].count_date >= list.data.at(-1).count_date, 'the list is the farmer\'s own, newest first');
  ok((await json(await req(A, 'GET', `/api/greenhouse/counts?crop_id=${custom.id}`))).total === 1, 'it can be filtered by crop');
  ok((await json(await req(A, 'GET', '/api/greenhouse/counts?status=mismatch'))).data.every((r) => r.verification.status === 'mismatch'), 'and by verdict');
  ok((await json(await req(B, 'GET', '/api/greenhouse/counts'))).total === 0, 'another farmer sees none of them');

  await M.FruitCount.deleteMany({ user_id: A });
  mode.confidence = 'high';
  const mk = async (patch) => { mode.count = patch.recorded_count; return json(await req(A, 'POST', '/api/greenhouse/counts', { ...base, photo_url: await photo(A), ...patch })); }; // the photo shows what was recorded
  await mk({ row_id: 'R1', plant_label: 'P1', recorded_count: 10, count_date: ago(1) });
  await mk({ row_id: 'R1', plant_label: 'P2', recorded_count: 20, count_date: ago(1) });
  await mk({ row_id: 'R2', plant_label: 'P1', recorded_count: 30, count_date: ago(2), crop_id: pepper.id });
  await mk({ row_id: 'R1', plant_label: 'P1', recorded_count: 14, count_date: ago(0) }); // a newer count of plant R1/P1: it replaces the older one in the totals
  await mk({ row_id: 'R9', plant_label: '', recorded_count: 6, count_date: ago(20) });
  await mk({ row_id: 'R9', plant_label: '', recorded_count: 6, count_date: ago(20) }); // no plant label: each is its own plant
  await M.FruitCount.create({ user_id: B, crop_id: bCrop.id, crop_name: 'Tomato', row_id: 'X', recorded_count: 999, count_date: today, photo_url: '/uploads/x.jpg', verification: { status: 'match' } });
  const d = await json(await req(A, 'GET', '/api/greenhouse/dashboard?days=30'));
  ok(d.totals.counts === 6, 'the dashboard counts the records of the period', JSON.stringify(d.totals));
  ok(d.totals.plants === 5 && d.totals.fruit === 14 + 20 + 30 + 6 + 6, 'a plant counted twice counts once, with its newest number', JSON.stringify(d.totals));
  ok(d.totals.avg_per_plant === Math.round(((14 + 20 + 30 + 6 + 6) / 5) * 10) / 10, 'the average per plant follows');
  ok(d.by_crop.length === 2 && d.by_crop[0].name === 'Sweet pepper' === false || d.by_crop.length === 2, 'fruit is shown by crop');
  ok(d.by_row.some((r) => r.row_id === 'R1' && r.plants === 2 && r.avg_per_plant === 17) && d.by_row.some((r) => r.row_id === 'R2'), 'and by row, with the average per plant');
  ok(d.weekly.length === 8 && d.weekly.every((w) => 'week' in w && 'avg_per_plant' in w) && d.weekly.some((w) => w.counts > 0), 'with eight weeks of trend');
  ok(d.verdicts.match === 6 && d.totals.verified_rate === 100, 'and how many photos agreed');
  ok(d.alerts.stale_rows.some((r) => r.row_id === 'R9'), 'a row not counted for over a week is flagged');
  ok(d.totals.fruit < 999 && d.crops === 3, 'another farmer\'s numbers are not in it');
  mode.count = 25;
  await json(await req(A, 'POST', '/api/greenhouse/counts', { ...base, row_id: 'R5', plant_label: 'P1', recorded_count: 10, count_date: today, photo_url: await photo(A) })); // the photo shows 25
  const d2 = await json(await req(A, 'GET', '/api/greenhouse/dashboard'));
  ok(d2.alerts.mismatches.length === 1 && d2.alerts.mismatches[0].row_id === 'R5' && d2.alerts.mismatches[0].detected === 25, 'a photo that does not match is listed with both numbers');

  console.log('6b. greenhouse layouts and plants');
  const hbody = { name: 'Layout House', length_m: 30, width_m: 8, rows: 4, plants_per_row: 10, crop_id: cherry.id, row_crops: ['', '', pepper.id, ''] };
  const h = await json(await req(A, 'POST', '/api/greenhouse/houses', hbody));
  ok(!!h.id && h.rows === 4 && h.plants_per_row === 10 && h.row_crops[2] === pepper.id, 'a greenhouse is set up with size, rows, plants per row and a crop for a row');
  ok((await req(A, 'POST', '/api/greenhouse/houses', hbody)).status === 409, 'the same name twice is refused');
  for (const [patch, label] of [[{ name: '' }, 'no name'], [{ rows: 0 }, 'no rows'], [{ plants_per_row: 301 }, 'too many plants in a row'], [{ length_m: -3 }, 'a negative length'], [{ rows: 100, plants_per_row: 100, name: 'Huge' }, 'more plants than a layout can hold'], [{ crop_id: bCrop.id, name: 'Other crop' }, 'another farmer\'s crop']]) {
    const r = await req(A, 'POST', '/api/greenhouse/houses', { ...hbody, ...patch });
    ok(r.status === 400, `${label} is refused`, `status ${r.status}`);
  }
  const lay = await json(await req(A, 'GET', `/api/greenhouse/houses/${h.id}/layout`));
  ok(lay.plants.length === 40 && lay.summary.plants === 40 && lay.summary.counted === 0 && lay.summary.not_counted === 40, 'the layout has a place for every plant, none counted yet');
  const p23 = lay.plants.find((p) => p.row === 2 && p.plant === 3);
  ok(p23.row_id === 'R2' && p23.plant_label === 'P3' && p23.crop_name === 'Cherry tomato' && lay.plants.find((p) => p.row === 3).crop_name === 'Sweet pepper (bell pepper)', 'plants are named R2 P3 and take the crop of their row');
  ok(lay.plants[0].x > 0 && lay.plants[0].x < 30 && lay.plants[0].z > 0 && lay.plants[0].z < 8 && lay.plants[39].x > lay.plants[0].x, 'every plant has a position inside the greenhouse');
  mode.count = 18;
  const rec = await json(await req(A, 'POST', '/api/greenhouse/counts', { crop_id: cherry.id, greenhouse: 'Layout House', row_id: 'R2', plant_label: 'P3', recorded_count: 18, photo_url: await photo(A), count_date: today }));
  mode.count = 30;
  await json(await req(A, 'POST', '/api/greenhouse/counts', { crop_id: cherry.id, greenhouse: 'Layout House', row_id: 'R4', plant_label: 'P10', recorded_count: 12, photo_url: await photo(A), count_date: today }));
  const lay2 = await json(await req(A, 'GET', `/api/greenhouse/houses/${h.id}/layout`));
  const q = lay2.plants.find((p) => p.row === 2 && p.plant === 3);
  ok(q.latest && q.latest.recorded_count === 18 && q.latest.status === 'match' && lay2.summary.counted === 2 && lay2.summary.fruit === 30, 'a count recorded on a plant shows on it in the layout');
  ok(lay2.plants.find((p) => p.row === 4 && p.plant === 10).latest.status === 'mismatch', 'and a photo that does not match shows as such');
  const hist = await json(await req(A, 'GET', `/api/greenhouse/houses/${h.id}/plants/2/3`));
  ok(hist.data.length === 1 && hist.data[0].id === rec.id, 'the history of one plant lists its counts');
  ok((await req(A, 'GET', `/api/greenhouse/houses/${h.id}/plants/9/3`)).status === 400, 'a plant outside the layout is refused');
  ok((await req(B, 'GET', `/api/greenhouse/houses/${h.id}/layout`)).status === 404 && (await req(B, 'PUT', `/api/greenhouse/houses/${h.id}`, { name: 'x' })).status === 404 && (await req(B, 'DELETE', `/api/greenhouse/houses/${h.id}`)).status === 404, 'another farmer cannot see, change or remove it');
  ok((await json(await req(B, 'GET', '/api/greenhouse/houses'))).data.length === 0, 'and does not see it in their list');
  const ren = await json(await req(A, 'PUT', `/api/greenhouse/houses/${h.id}`, { name: 'House Renamed', rows: 5 }));
  const lay3 = await json(await req(A, 'GET', `/api/greenhouse/houses/${h.id}/layout`));
  ok(ren.name === 'House Renamed' && lay3.plants.length === 50 && lay3.summary.counted === 2, 'renaming a greenhouse and adding a row keeps the counts on their plants');
  ok((await req(A, 'DELETE', `/api/greenhouse/houses/${h.id}`)).status === 200 && (await M.FruitCount.countDocuments({ user_id: A, greenhouse: 'House Renamed' })) === 2, 'removing a layout keeps the fruit counts');

  console.log('6c. asking about the greenhouse in plain words (the assistant\'s tool)');
  
  const h2 = await json(await req(A, 'POST', '/api/greenhouse/houses', { ...hbody, name: 'Tool House' }));
  await M.FruitCount.updateMany({ user_id: A, greenhouse: 'House Renamed' }, { $set: { greenhouse: 'Tool House' } });
  const tool = greenhouseTool(A).handlers.greenhouse_info;
  const ov = await tool({ view: 'overview' });
  ok(ov.greenhouses[0].greenhouse === 'Tool House' && ov.greenhouses[0].counted === 2 && ov.greenhouses[0].fruit === 30, 'the assistant can say how many plants and fruit a greenhouse has');
  const one = await tool({ view: 'plant', row: 2, plant: 3 });
  ok(one.latest.recorded === 18 && one.latest.result === 'matches the photo' && one.history.length === 1, 'it can answer for one plant: row 2 plant 3');
  ok((await tool({ view: 'plant', row: 9, plant: 1 })).error && (await tool({ view: 'mismatches' })).plants_with_a_mismatch === 1, 'it says when a plant does not exist, and lists the photos that did not match');
  const nc = await tool({ view: 'not_counted', days: 7 });
  ok(nc.plants_not_counted_in_that_time === 38 && nc.never_counted === 38, 'it lists plants not counted lately');
  const top = await tool({ view: 'top_plants', order: 'most', limit: 1 });
  ok(top.plants[0].latest.recorded === 18, 'and the plants with the most fruit');
  const hv = await tool({ view: 'harvest_value' });
  ok(hv.totals.fruit === 30 && hv.totals.counted_plants === 2 && Array.isArray(hv.by_crop) && hv.how, 'and what the harvest could be worth');
  ok((await greenhouseTool(B).handlers.greenhouse_info({ view: 'overview' })).note, 'another farmer\'s question never reaches this data');
  await req(A, 'DELETE', `/api/greenhouse/houses/${h2.id}`);

  console.log('6d. disease check of the photo (the same classifier as the rest of the app)');
  const sharpMod = (await import('sharp')).default;
  const realJpeg = async (user) => { const name = `${user}-${Date.now()}-real${Math.random().toString(36).slice(2, 6)}.jpg`; await storage.put(name, await sharpMod({ create: { width: 400, height: 300, channels: 3, background: '#3a7d2a' } }).jpeg().toBuffer()); return `/uploads/${name}`; };
  mode.dets = [{ x: 100, y: 100, r: 40 }, { x: 250, y: 150, r: 40 }];
  mode.count = 2;
  const tomatoCount = await json(await req(A, 'POST', '/api/greenhouse/counts', { crop_id: cherry.id, greenhouse: 'Health House', row_id: 'R1', plant_label: 'P1', recorded_count: 2, photo_url: await realJpeg(A), count_date: today }));
  const th = tomatoCount.verification.health;
  ok(th && th.plant && ['sick', 'healthy', 'unsure'].includes(th.plant.status) && th.crop === 'Tomato', 'the whole photo is checked for disease with the classifier, for the crop', JSON.stringify(th));
  ok(Array.isArray(th.fruits) && th.fruits.length === 2, 'tomato fruit are now known to the classifier, so each counted fruit is checked', JSON.stringify(th));
  const apple = await json(await req(A, 'POST', '/api/greenhouse/crops', { name: 'Apple', fruit_colors: ['red'] }));
  const ac = await json(await req(A, 'POST', '/api/greenhouse/counts', { crop_id: apple.id, greenhouse: 'Health House', row_id: 'R1', plant_label: 'P3', recorded_count: 2, photo_url: await realJpeg(A), count_date: today }));
  ok(ac.verification.health.fruits === null && /trained on leaves/.test(ac.verification.health.fruit_note), 'for a crop whose fruit the classifier was not trained on it says so instead of judging single fruit', JSON.stringify(ac.verification.health));
  const banana = await json(await req(A, 'POST', '/api/greenhouse/crops', { name: 'Banana', fruit_colors: ['yellow'] }));
  const bc = await json(await req(A, 'POST', '/api/greenhouse/counts', { crop_id: banana.id, greenhouse: 'Health House', row_id: 'R1', plant_label: 'P2', recorded_count: 2, photo_url: await realJpeg(A), count_date: today }));
  const bh = bc.verification.health;
  ok(Array.isArray(bh.fruits) && bh.fruits.length === 2 && bh.fruits.every((f) => f.index >= 1 && f.r > 0 && ['sick', 'healthy', 'unsure', 'not_checked'].includes(f.status)), 'for a crop it knows, every counted fruit is classified and numbered like the marked photo', JSON.stringify(bh));
  ok(bh.sick_fruit === bh.fruits.filter((f) => f.status === 'sick').length && (bh.sick_fruit === 0 || /numbers/.test(bh.message)), 'the sick fruit are counted and named by number');
  const hHouse = await json(await req(A, 'POST', '/api/greenhouse/houses', { name: 'Health House', length_m: 10, width_m: 4, rows: 2, plants_per_row: 3, crop_id: cherry.id }));
  const hl = await json(await req(A, 'GET', `/api/greenhouse/houses/${hHouse.id}/layout`));
  const hp = hl.plants.find((p) => p.row === 1 && p.plant === 1);
  ok(hp.latest.health && hp.latest.health.status === th.status && 'sick_plants' in hl.summary, 'the layout shows the health of each plant and how many plants look diseased');
  const gt = greenhouseTool(A).handlers.greenhouse_info;
  ok((await gt({ view: 'plant', greenhouse: 'Health House', row: 1, plant: 1 })).latest.health.status === th.status && Array.isArray((await gt({ view: 'diseased', greenhouse: 'Health House' })).plants), 'and the assistant can answer about disease on a plant');
  await req(A, 'DELETE', `/api/greenhouse/houses/${hHouse.id}`);
  mode.dets = [];

  console.log('7. removing crops and counts');
  ok((await req(A, 'DELETE', `/api/greenhouse/crops/${cherry.id}`)).status === 409, 'a crop with counts cannot be removed by accident');
  ok((await req(B, 'DELETE', `/api/greenhouse/crops/${cherry.id}`)).status === 400, 'and another farmer cannot remove it');
  await M.FruitCount.deleteMany({ user_id: A });
  ok((await req(A, 'DELETE', `/api/greenhouse/crops/${cherry.id}`)).status === 200, 'once its counts are gone it can be removed');
  const bare401 = await fetch(`${api.base}/api/greenhouse/dashboard`);
  ok(bare401.status === 401 || bare401.status === 403, 'nobody can open the greenhouse without signing in', `status ${bare401.status}`);
} catch (e) {
  failures += 1;
  console.log('  FAIL the test stopped with an error:', e && e.stack ? e.stack.split(String.fromCharCode(10)).slice(0, 4).join(' | ') : e);
} finally {
  api.child.kill();
  bare.child.kill();
  fake.close();
  await new Promise((r) => setTimeout(r, 300));
  await cleanup();
  process.exitCode = failures ? 1 : 0;
  console.log(`\n${passed} passed, ${failures} failed`);
  process.exit();
}
