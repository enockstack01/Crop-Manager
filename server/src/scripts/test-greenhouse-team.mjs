/**
 * Checks the second round of greenhouse features on the server:
 *
 *   node src/scripts/test-greenhouse-team.mjs
 *
 * - layouts with rows of different lengths, sub rows A and B, a door, a compass direction and planting patterns
 * - adding plant positions, freezing and deactivating a position (a reason is always needed), labels on counts
 * - several photos of one plant joined into one collage that is counted once, and a warning when photos overlap
 * - small, medium, large or all sizes
 * - the farm manager and the data collector: what each may open and do
 *
 * Starts the API itself in test mode with a STAND-IN fruit counter whose answers the test controls. Removes everything it creates.
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { connectDB } from '../config/db.js';
import * as M from '../models/index.js';
import { storage } from '../lib/storage.js';
import { sizeBand } from '../lib/greenhouse/verify.js';
import { positionsOf, parseRowId, hasPosition, totalPositions } from '../lib/greenhouse/layout.js';
import { columnsFor } from '../lib/greenhouse/collage.js';
import { positionsOf as clientPositions, totalPositions as clientTotal } from '../../../client/src/lib/greenhouseLayout.js';

const PREFIX = 'ghteam_';
const OWNER = `${PREFIX}owner`;
const MGR = `${PREFIX}manager`;
const COL = `${PREFIX}collector`;
const OUT = `${PREFIX}outsider`;
let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };

await connectDB();
const cleanup = async () => {
  await Promise.all([M.GreenhouseCrop, M.FruitCount, M.GreenhouseHouse, M.GreenhouseMember, M.Profile].map((Model) => Model.deleteMany({ user_id: new RegExp(`^${PREFIX}`) })));
  await M.GreenhouseMember.deleteMany({ invited_email: new RegExp(`@${PREFIX}`) });
  await storage.removeWithPrefix(PREFIX);
};
await cleanup();
const email = (u) => `${u}@${PREFIX}local.test`;
for (const u of [OWNER, MGR, COL, OUT]) await M.Profile.create({ user_id: u, email: email(u), email_verified: true, full_name: u.replace(PREFIX, ''), account_status: 'active', is_active: true, onboarded: true });

/* ---- the stand-in counter */
const seen = { count: 0, overlap: 0 };
const mode = { dets: [], size: [400, 300], count: 12, overlap: [] };
const fake = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (d) => chunks.push(d));
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/health') { res.end('{"ok":true}'); return; }
    if (req.url.startsWith('/overlap')) { seen.overlap += 1; res.end(JSON.stringify({ pairs: mode.overlap })); return; }
    seen.count += 1;
    const body = Buffer.concat(chunks).toString('latin1');
    seen.lastImgsz = (body.match(/name="imgsz"\r\n\r\n([^\r]*)/) || [])[1] || null;
    res.end(JSON.stringify({ count: mode.count, confidence: 'high', warnings: [], detections: mode.dets, image_size: mode.size, method: 'stand-in', annotated_jpeg_b64: Buffer.from('marked-photo').toString('base64') }));
  });
});
await new Promise((r) => fake.listen(0, r));
const counterUrl = `http://localhost:${fake.address().port}`;

const child = spawn(process.execPath, ['src/index.js'], { cwd: new URL('../../', import.meta.url), env: { ...process.env, PORT: '5091', HF_TOKEN: '', AI_MOCK: '1', ALLOW_DEV_AUTH: '1', FRUIT_COUNTER_URL: counterUrl, FRUIT_COUNTER_TOKEN: '', GREENHOUSE_CHECKS_PER_MINUTE: '1000', VISION_TEST_STUB: 'ok' }, stdio: ['ignore', 'pipe', 'pipe'] });
const base = 'http://localhost:5091';
for (let i = 0; i < 180; i += 1) {
  try { if ((await fetch(`${base}/api/health`)).status < 500) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 500));
}
/** A call as `user`; `farm` names the farm owner when the user works on someone else's farm. */
const req = (user, method, path, body, farm) => fetch(base + path, { method, headers: { 'x-dev-user': user, 'Content-Type': 'application/json', ...(farm ? { 'x-farm-owner': farm } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const json = async (r) => { try { return await r.json(); } catch { return {}; } };
const jpeg = async (user, color = '#3a7d2a') => { const name = `${user}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`; await storage.put(name, await sharp({ create: { width: 400, height: 300, channels: 3, background: color } }).jpeg().toBuffer()); return `/uploads/${name}`; };
const today = new Date().toISOString().slice(0, 10);

try {
  console.log('1. layouts: rows of different lengths, sub rows, door, direction, patterns');
  const cherry = await json(await req(OWNER, 'POST', '/api/greenhouse/crops', { catalog_key: 'cherry_tomato' }));
  const shape = { name: 'Shaped', length_m: 20, width_m: 9, row_defs: [{ plants: 4 }, { plants: 6 }, { plants: 3, sub_rows: 2 }], orientation_deg: 90, door: { wall: 'bottom', position: 0.3, width_m: 1.5 }, pattern: 'zigzag', crop_id: cherry.id };
  const made = await req(OWNER, 'POST', '/api/greenhouse/houses', shape);
  const house = await json(made);
  ok(made.status === 201 && house.rows === 3 && house.plants_per_row === 6 && house.total_positions === 16, 'a greenhouse with rows of 4, 6 and a double row of 3 has 16 positions', JSON.stringify(house).slice(0, 200));
  const lay = await json(await req(OWNER, 'GET', `/api/greenhouse/houses/${house.id}/layout`));
  const ids = lay.plants.map((p) => `${p.row_id} ${p.plant_label}`);
  ok(lay.plants.length === 16 && lay.summary.plants === 16 && ids.includes('R3A P3') && ids.includes('R3B P1') && !ids.includes('R3 P1') && ids.includes('R1 P4') && !ids.includes('R1 P5'), 'positions are named R1 P4, R2 P6 and, in the double row, R3A P1 and R3B P3');
  const r3a = lay.plants.filter((p) => p.row_id === 'R3A');
  const r3b = lay.plants.filter((p) => p.row_id === 'R3B');
  ok(r3a[0].z < r3b[0].z && Math.abs(r3a[0].z - r3b[0].z) < 3 && r3a[0].x === r3b[0].x, 'the two sub rows sit side by side on the same line');
  const r1 = lay.plants.filter((p) => p.row === 1);
  ok(r1[0].z !== r1[1].z && r1[0].z === r1[2].z, 'the zig-zag pattern alternates plants either side of the line');
  ok(lay.door && lay.door.wall === 'bottom' && lay.door.from < lay.door.to && lay.house.orientation_deg === 90 && lay.house.pattern === 'zigzag', 'the door and the compass direction come back with the layout');
  const stag = await json(await req(OWNER, 'POST', '/api/greenhouse/houses', { name: 'Stag', length_m: 10, width_m: 4, rows: 2, plants_per_row: 4, pattern: 'staggered', plant_spacing_m: 1.5, row_spacing_m: 1.2 }));
  const sl = await json(await req(OWNER, 'GET', `/api/greenhouse/houses/${stag.id}/layout`));
  const p11 = sl.plants.find((p) => p.row_id === 'R1' && p.plant_label === 'P1');
  const p21 = sl.plants.find((p) => p.row_id === 'R2' && p.plant_label === 'P1');
  const p12 = sl.plants.find((p) => p.row_id === 'R1' && p.plant_label === 'P2');
  ok(Math.abs(p12.x - p11.x - 1.5) < 0.011 && Math.abs(p21.x - p11.x - 0.75) < 0.011 && Math.abs(p21.z - p11.z - 1.2) < 0.011, 'custom spacing and the staggered pattern place the plants as asked');
  const legacy = await json(await req(OWNER, 'POST', '/api/greenhouse/houses', { name: 'Plain', length_m: 12, width_m: 6, rows: 3, plants_per_row: 5 }));
  const ll = await json(await req(OWNER, 'GET', `/api/greenhouse/houses/${legacy.id}/layout`));
  ok(ll.plants.length === 15 && ll.plants.every((p) => p.state === 'active' && !p.sub) && ll.door === null, 'a plain rows-by-plants greenhouse still works as before');
  ok((await req(OWNER, 'POST', '/api/greenhouse/houses', { ...shape, name: 'Bad door', door: { wall: 'roof' } })).status === 400, 'a door in a wall that does not exist is refused');
  ok((await req(OWNER, 'POST', '/api/greenhouse/houses', { ...shape, name: 'Bad pattern', pattern: 'spiral' })).status === 400, 'an unknown planting pattern is refused');
  ok((await req(OWNER, 'POST', '/api/greenhouse/houses', { ...shape, name: 'Huge', row_defs: Array.from({ length: 60 }, () => ({ plants: 200 })) })).status === 400, 'a layout of more than 6000 positions is refused');
  const edited = await json(await req(OWNER, 'PUT', `/api/greenhouse/houses/${legacy.id}`, { row_defs: [{ plants: 2 }, { plants: 5, start: 2 }, { plants: 3 }], door: null }));
  ok(edited.rows === 3 && edited.row_defs[1].start === 2 && edited.door === null, 'rows can be reshaped later and the door removed');
  const p = positionsOf({ rows: 1, plants_per_row: 4, length_m: 8, width_m: 2, row_defs: [{ plants: 2, start: 2, sub_rows: 1 }] });
  ok(p.length === 2 && p[0].x > 4, 'a row that starts later is placed further along the house');
  ok(parseRowId({ rows: 1, plants_per_row: 1, row_defs: [{ plants: 1, sub_rows: 2 }] }, 'R1') === null && hasPosition({ rows: 1, plants_per_row: 3, row_defs: [] }, 'R1', 'P3') && !hasPosition({ rows: 1, plants_per_row: 3, row_defs: [] }, 'R1', 'P4') && totalPositions({ rows: 2, plants_per_row: 3, row_defs: [] }) === 6, 'the position helpers agree on what exists');

  const sameAsClient = [shape, { length_m: 10, width_m: 4, rows: 2, plants_per_row: 4, pattern: 'staggered', plant_spacing_m: 1.5, row_spacing_m: 1.2 }, { length_m: 30, width_m: 8, rows: 5, plants_per_row: 9, pattern: 'zigzag', row_defs: [{ plants: 9 }, { plants: 4, start: 3 }, { plants: 5, sub_rows: 2 }, { plants: 9 }, { plants: 0 }] }].every((h0) => {
    const h = { rows: h0.row_defs ? h0.row_defs.length : h0.rows, plants_per_row: h0.plants_per_row || 6, ...h0 };
    const a = positionsOf(h);
    const b = clientPositions(h);
    return a.length === b.length && clientTotal(h) === totalPositions(h) && a.every((q, i) => q.row_id === b[i].row_id && q.plant_label === b[i].plant_label && q.x === b[i].x && q.z === b[i].z);
  });
  ok(sameAsClient, 'the layout form in the browser places every plant exactly where the server does');

  console.log('2. adding positions, freezing and deactivating (always with a reason)');
  const add = await req(OWNER, 'POST', `/api/greenhouse/houses/${house.id}/positions`, { row_id: 'R1', count: 2 });
  const added = await json(add);
  ok(add.status === 201 && added.plants_in_row === 6, 'plant positions are added to the end of a row');
  await req(OWNER, 'POST', `/api/greenhouse/houses/${house.id}/positions`, { row_id: 'R3A', count: 1 });
  const lay2 = await json(await req(OWNER, 'GET', `/api/greenhouse/houses/${house.id}/layout`));
  ok(lay2.plants.length === 16 + 2 + 2 && lay2.plants.some((p) => p.row_id === 'R3B' && p.plant_label === 'P4'), 'a double row grows on both sub rows together');
  ok((await req(OWNER, 'POST', `/api/greenhouse/houses/${house.id}/positions`, { row_id: 'R9', count: 1 })).status === 404, 'a row that does not exist is refused');
  const pos = (body, user = OWNER, farm) => req(user, 'PUT', `/api/greenhouse/houses/${house.id}/positions`, body, farm);
  ok((await pos({ row_id: 'R2', plant_label: 'P2', state: 'frozen' })).status === 400, 'freezing a plant without a reason is refused');
  ok((await pos({ row_id: 'R2', plant_label: 'P2', state: 'inactive', reason: '  ' })).status === 400, 'deactivating a position without a reason is refused');
  ok((await pos({ row_id: 'R2', plant_label: 'P99', state: 'frozen', reason: 'x' })).status === 404, 'a position that does not exist is refused');
  const fz = await json(await pos({ row_id: 'R2', plant_label: 'P2', state: 'frozen', reason: 'Late blight, leave until the spray works' }));
  ok(fz.state === 'frozen' && /blight/.test(fz.state_reason), 'a sick plant is frozen with the reason');
  await pos({ row_id: 'R2', plant_label: 'P3', state: 'inactive', reason: 'Uprooted after wilt' });
  const lay3 = await json(await req(OWNER, 'GET', `/api/greenhouse/houses/${house.id}/layout`));
  const s3 = lay3.summary;
  ok(lay3.plants.find((p) => p.row_id === 'R2' && p.plant_label === 'P3').state === 'inactive' && s3.frozen === 1 && s3.inactive === 1 && s3.active === s3.plants - 2, 'the layout shows frozen and deactivated positions and counts them');
  ok(s3.not_counted === s3.plants - 1, 'a deactivated position is no longer expected to be counted');
  const countBody = { crop_id: cherry.id, greenhouse: 'Shaped', row_id: 'R2', plant_label: 'P3', recorded_count: 5, photo_url: await jpeg(OWNER), count_date: today };
  const onDead = await req(OWNER, 'POST', '/api/greenhouse/counts', countBody);
  ok(onDead.status === 409 && /Uprooted/.test((await json(onDead)).message || ''), 'a deactivated position takes no new count, and says why');
  await pos({ row_id: 'R2', plant_label: 'P3', state: 'active', reason: 'Replanted' });
  ok((await req(OWNER, 'POST', '/api/greenhouse/counts', countBody)).status === 201, 'once reactivated it can be recorded again');
  await pos({ row_id: 'R1', plant_label: 'P1', label: 'Mama Jane\'s tomato' });
  const lay4 = await json(await req(OWNER, 'GET', `/api/greenhouse/houses/${house.id}/layout`));
  ok(lay4.plants.find((p) => p.row_id === 'R1' && p.plant_label === 'P1').label === 'Mama Jane\'s tomato' && lay4.plants.find((p) => p.row_id === 'R2' && p.plant_label === 'P3').state === 'active', 'a position can be given a name without freezing it');
  const log = await json(await req(OWNER, 'GET', `/api/greenhouse/houses/${house.id}/positions/log`));
  ok(log.data.length >= 5 && log.data.some((e) => e.action === 'frozen' && /blight/.test(e.reason)) && log.data.some((e) => e.action === 'inactive') && log.data.some((e) => e.action === 'reactivated') && log.data.some((e) => e.action === 'added'), 'every change is logged with the reason and who did it');
  ok(log.data[0].by === OWNER, 'the log says who');

  console.log('3. a label on a count, and editing it');
  const lab = await json(await req(OWNER, 'POST', '/api/greenhouse/counts', { ...countBody, plant_label: 'P1', row_id: 'R1', label: 'first flush', recorded_count: 12 }));
  ok(lab.label === 'first flush' && lab.entered_by === OWNER, 'a count can carry a label and remembers who recorded it');
  const relab = await json(await req(OWNER, 'PUT', `/api/greenhouse/counts/${lab.id}`, { label: 'second flush' }));
  ok(relab.label === 'second flush' && relab.recorded_count === 12, 'the label can be changed when the count is edited');

  console.log('4. several photos become one collage that is counted once');
  mode.count = 9; mode.dets = []; mode.overlap = [];
  const before = { ...seen };
  const urls = [await jpeg(OWNER, '#aa2222'), await jpeg(OWNER, '#22aa22'), await jpeg(OWNER, '#2222aa')];
  const multi = await req(OWNER, 'POST', '/api/greenhouse/counts', { ...countBody, row_id: 'R1', plant_label: 'P2', recorded_count: 9, photo_urls: urls });
  const mc = await json(multi);
  ok(multi.status === 201 && mc.photo_urls.length === 3 && /-collage\.jpg$/.test(mc.photo_url) && mc.collage.photos === 3 && mc.collage.columns === 2, 'three photos are joined into a 2-column collage that becomes the photo of the count', JSON.stringify(mc).slice(0, 220));
  ok(seen.count === before.count + 1 && seen.lastImgsz === '1280', 'the counter is asked once, for the collage, with a larger working size');
  const stored = await storage.get(mc.photo_url.split('/').pop());
  const meta = await sharp(stored).metadata();
  ok(meta.width === 1280 && meta.height === 960, 'the collage is 2 by 2 cells of 640 by 480', `${meta.width}x${meta.height}`);
  ok(mc.verification.status === 'match' && mc.verification.photos === 3, 'the verdict is about the whole collage');
  ok(columnsFor(1) === 1 && columnsFor(4) === 2 && columnsFor(5) === 3 && columnsFor(10) === 4, 'the collage grid grows with the number of photos');
  mode.overlap = [{ a: 1, b: 3 }];
  const ov = await json(await req(OWNER, 'POST', '/api/greenhouse/counts', { ...countBody, row_id: 'R1', plant_label: 'P3', recorded_count: 9, photo_urls: [await jpeg(OWNER), await jpeg(OWNER), await jpeg(OWNER)] }));
  ok(ov.collage.overlap_warnings.length === 1 && ov.collage.overlap_warnings[0].a === 1 && ov.collage.overlap_warnings[0].b === 3, 'photos that show the same part of the plant are reported, so a fruit is not counted twice');
  mode.overlap = [];
  ok((await req(OWNER, 'POST', '/api/greenhouse/counts', { ...countBody, row_id: 'R1', plant_label: 'P4', photo_urls: Array.from({ length: 13 }, (_x, i) => `/uploads/${OWNER}-x${i}.jpg`) })).status === 400, 'more than 12 photos for one plant are refused');
  const single = await json(await req(OWNER, 'POST', '/api/greenhouse/counts', { ...countBody, row_id: 'R1', plant_label: 'P5', recorded_count: 9, photo_url: await jpeg(OWNER) }));
  ok(single.collage === null && single.photo_urls.length === 1, 'one photo stays one photo, as before');
  const edit2 = await json(await req(OWNER, 'PUT', `/api/greenhouse/counts/${mc.id}`, { photo_urls: [urls[0], urls[1]] }));
  ok(edit2.collage.photos === 2 && edit2.photo_urls.length === 2 && edit2.photo_url !== mc.photo_url, 'photos can be changed when a count is edited: the collage is rebuilt');

  console.log('5. small, medium, large or all sizes');
  const dets = [10, 12, 14, 20, 22, 24, 40, 44, 48].map((r, i) => ({ x: 20 + i * 30, y: 100, r }));
  ok(JSON.stringify(['small', 'medium', 'large', 'all'].map((s) => sizeBand(dets, s).count)) === '[3,3,3,9]' && sizeBand(dets.slice(0, 2), 'small') === null, 'fruit are cut into thirds by size; with fewer than 3 fruit sizes cannot be told apart');
  mode.count = 9; mode.dets = dets;
  const small = await json(await req(OWNER, 'POST', '/api/greenhouse/counts', { ...countBody, row_id: 'R1', plant_label: 'P6', recorded_count: 3, fruit_size: 'small', photo_url: await jpeg(OWNER) }));
  ok(small.fruit_size === 'small' && small.verification.detected === 3 && small.verification.detected_all_sizes === 9 && small.verification.status === 'match' && /approximate/.test(small.verification.message), 'a count of small fruit is checked against the small fruit in the photo');
  const allSizes = await json(await req(OWNER, 'POST', '/api/greenhouse/counts', { ...countBody, row_id: 'R1', plant_label: 'P6', recorded_count: 9, photo_url: await jpeg(OWNER) }));
  ok(allSizes.fruit_size === 'all' && allSizes.verification.detected === 9, 'with no size chosen every fruit is counted');
  ok((await req(OWNER, 'POST', '/api/greenhouse/counts', { ...countBody, row_id: 'R1', plant_label: 'P6', fruit_size: 'huge', photo_url: await jpeg(OWNER) })).status === 400, 'a size that is not small, medium, large or all is refused');
  mode.dets = [];

  console.log('6. the farm manager and the data collector');
  const invM = await req(OWNER, 'POST', '/api/greenhouse/team', { email: email(MGR), role: 'manager', name: 'Farm manager' });
  const invC = await req(OWNER, 'POST', '/api/greenhouse/team', { email: email(COL), role: 'collector' });
  ok(invM.status === 201 && invC.status === 201 && (await json(invM)).status === 'invited', 'the owner invites a farm manager and a data collector by email');
  ok((await req(OWNER, 'POST', '/api/greenhouse/team', { email: email(MGR), role: 'collector' })).status === 409 && (await req(OWNER, 'POST', '/api/greenhouse/team', { email: 'nope', role: 'manager' })).status === 400 && (await req(OWNER, 'POST', '/api/greenhouse/team', { email: 'x@y.zz', role: 'boss' })).status === 400, 'a person cannot be added twice, and the address and role are checked');
  ok((await req(MGR, 'GET', '/api/greenhouse/houses', undefined, OWNER)).status === 403, 'a person who has not accepted yet cannot open the farm');
  const accM = await json(await req(MGR, 'GET', '/api/greenhouse/access'));
  const accC = await json(await req(COL, 'GET', '/api/greenhouse/access'));
  ok(accM.farms.length === 1 && accM.farms[0].owner_id === OWNER && accM.farms[0].role === 'manager' && accC.farms[0].role === 'collector', 'signing in with the invited address accepts the invitation and lists the farm');
  ok((await req(MGR, 'GET', '/api/greenhouse/team', undefined, OWNER)).status === 403, 'the team list is for the owner only');
  ok((await json(await req(OUT, 'GET', '/api/greenhouse/access'))).farms.length === 0 && (await req(OUT, 'GET', '/api/greenhouse/houses', undefined, OWNER)).status === 403, 'someone who was not invited gets nothing');

  // the collector: plan view and recording, nothing else
  const cLay = await req(COL, 'GET', `/api/greenhouse/houses/${house.id}/layout`, undefined, OWNER);
  const cl = await json(cLay);
  ok(cLay.status === 200 && cl.plants.length === 20 && cl.plants.every((p) => !p.latest || p.latest.health === null) && !('sick_plants' in cl.summary), 'the data collector gets the plan view without disease details');
  const cPhoto = await jpeg(COL);
  const cCount = await req(COL, 'POST', '/api/greenhouse/counts', { ...countBody, row_id: 'R2', plant_label: 'P4', recorded_count: 9, photo_url: cPhoto, fruit_size: 'all' }, OWNER);
  const cc = await json(cCount);
  ok(cCount.status === 201 && cc.entered_by === COL && cc.verification.health === undefined, 'the data collector records a count on the owner\'s farm, with the check result but no disease details');
  const oSees = await json(await req(OWNER, 'GET', `/api/greenhouse/counts/${cc.id}`));
  ok(oSees.entered_by === COL && oSees.verification.health !== undefined, 'the owner sees who recorded it, with the disease details');
  const re = await req(OWNER, 'POST', `/api/greenhouse/counts/${cc.id}/verify`);
  ok(re.status === 200 && (await json(re)).verification.status === 'match', 'the photo the collector took is accepted when the owner checks it again');
  ok((await json(await req(COL, 'GET', '/api/greenhouse/counts', undefined, OWNER))).data.every((c) => c.entered_by === COL) && (await json(await req(COL, 'GET', '/api/greenhouse/counts', undefined, OWNER))).total === 1, 'the data collector sees only what they recorded');
  const ownersCount = await json(await req(OWNER, 'POST', '/api/greenhouse/counts', { ...countBody, row_id: 'R2', plant_label: 'P1', photo_url: await jpeg(OWNER) }));
  ok((await req(COL, 'PUT', `/api/greenhouse/counts/${ownersCount.id}`, { recorded_count: 1 }, OWNER)).status === 404 && (await req(COL, 'PUT', `/api/greenhouse/counts/${cc.id}`, { label: 'checked twice' }, OWNER)).status === 200, 'a collector can edit their own counts, not other people\'s');
  const denied = await Promise.all([
    req(COL, 'DELETE', `/api/greenhouse/counts/${cc.id}`, undefined, OWNER), req(COL, 'GET', '/api/greenhouse/dashboard', undefined, OWNER),
    req(COL, 'POST', '/api/greenhouse/houses', { name: 'Mine', length_m: 5, width_m: 5, rows: 1, plants_per_row: 1 }, OWNER), req(COL, 'PUT', `/api/greenhouse/houses/${house.id}`, { name: 'Renamed' }, OWNER),
    req(COL, 'POST', '/api/greenhouse/crops', { catalog_key: 'tomato' }, OWNER), req(COL, 'GET', `/api/greenhouse/houses/${house.id}/health`, undefined, OWNER), req(COL, 'POST', '/api/greenhouse/team', { email: 'a@b.cc', role: 'manager' }, OWNER),
  ]);
  ok(denied.every((r) => r.status === 403), 'the data collector cannot delete counts, see the dashboard or disease reports, or change layouts, crops or the team', denied.map((r) => r.status).join(','));
  const freezeByCollector = await pos({ row_id: 'R2', plant_label: 'P5', state: 'frozen', reason: 'Wilting, spotted while recording' }, COL, OWNER);
  ok(freezeByCollector.status === 200 && (await json(await req(OWNER, 'GET', `/api/greenhouse/houses/${house.id}/positions/log`))).data[0].by === COL, 'a collector can freeze a plant with a reason, and the log names them');

  // the farm manager: records and disease details, no plan or 3D data
  const sick = { status: 'sick', plant: { status: 'sick', disease: 'Late blight', confidence: 0.91, alternatives: [] }, fruits: [{ index: 1, status: 'sick' }, { index: 2, status: 'healthy' }], sick_fruit: 1, checked_fruit: 2, message: 'Possible disease: the plant shows signs of late blight.' };
  await M.FruitCount.updateOne({ _id: ownersCount.id }, { $set: { 'verification.health': sick } });
  const mGet = await req(MGR, 'GET', `/api/greenhouse/houses/${house.id}/layout`, undefined, OWNER);
  ok(mGet.status === 403, 'the farm manager has no plan or 3D data');
  const rep = await json(await req(MGR, 'GET', `/api/greenhouse/houses/${house.id}/health`, undefined, OWNER));
  const rp = (rep.plants || []).find((x) => x.row_id === 'R2' && x.plant_label === 'P1');
  ok(rep.summary.sick_plants === rep.plants.length && rep.summary.sick_plants >= 1 && rep.summary.counted >= 4 && rp && rp.disease === 'Late blight' && rp.sick_fruit_numbers[0] === 1 && rp.disease_confidence === 0.91, 'the farm manager sees how many plants are diseased and every detail of each', JSON.stringify(rep).slice(0, 400));
  const mCounts = await json(await req(MGR, 'GET', '/api/greenhouse/counts', undefined, OWNER));
  ok(mCounts.total >= 5 && mCounts.data.some((c) => c.verification?.health?.status === 'sick'), 'the farm manager reads all the records, with disease details');
  ok((await req(MGR, 'GET', '/api/greenhouse/dashboard', undefined, OWNER)).status === 200, 'and the dashboard');
  const mDenied = await Promise.all([
    req(MGR, 'POST', '/api/greenhouse/counts', countBody, OWNER), req(MGR, 'POST', '/api/greenhouse/check', { ...countBody }, OWNER), req(MGR, 'DELETE', `/api/greenhouse/counts/${cc.id}`, undefined, OWNER),
    pos({ row_id: 'R1', plant_label: 'P1', label: 'x' }, MGR, OWNER), req(MGR, 'PUT', `/api/greenhouse/houses/${house.id}`, { name: 'x' }, OWNER), req(MGR, 'POST', '/api/greenhouse/team', { email: 'a@b.cc', role: 'manager' }, OWNER),
  ]);
  ok(mDenied.every((r) => r.status === 403), 'the farm manager cannot record, change positions or layouts, or manage the team', mDenied.map((r) => r.status).join(','));
  ok((await json(await req(OWNER, 'GET', '/api/greenhouse/team'))).data.length === 2, 'the owner sees the team');
  const tid = (await json(await req(OWNER, 'GET', '/api/greenhouse/team'))).data.find((t) => t.role === 'collector').id;
  ok((await json(await req(OWNER, 'PUT', `/api/greenhouse/team/${tid}`, { role: 'manager' }))).role === 'manager', 'a role can be changed');
  await req(OWNER, 'PUT', `/api/greenhouse/team/${tid}`, { role: 'collector' });
  ok((await req(OWNER, 'DELETE', `/api/greenhouse/team/${tid}`)).status === 200 && (await req(COL, 'GET', '/api/greenhouse/houses', undefined, OWNER)).status === 403, 'when the owner removes someone their access ends at once');
  ok((await json(await req(MGR, 'GET', '/api/greenhouse/houses', undefined, OWNER))).data.length >= 3, 'the others keep theirs');
  ok((await req(MGR, 'GET', '/api/greenhouse/houses')).status === 200 && (await json(await req(MGR, 'GET', '/api/greenhouse/houses'))).data.length === 0, 'without naming a farm everyone works on their own, which is empty for them');
} catch (e) {
  failures += 1;
  console.log('  FAIL the test stopped with an error:', e && e.stack ? e.stack.split(String.fromCharCode(10)).slice(0, 4).join(' | ') : e);
} finally {
  child.kill();
  fake.close();
  await new Promise((r) => setTimeout(r, 300));
  await cleanup();
  process.exitCode = failures ? 1 : 0;
  console.log(`\n${passed} passed, ${failures} failed`);
  process.exit();
}
