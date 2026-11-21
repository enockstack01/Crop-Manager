/**
 * Checks the rules of the greenhouse tab on the phone (src/lib/greenhouseRules.ts): what a fruit count needs before it can be sent,
 * and how each result of the photo check is shown.
 *
 *   node mobile/scripts/test-greenhouse.mjs
 */
import { countProblem, VERDICTS, COLOR_HEX, houseProblem, heatColor, markerColor, STATUS_COLOR, FRUIT_SIZES, TABS_BY_ROLE } from '../src/lib/greenhouseRules.ts';
import { positionsOf, totalPositions, rowDefsOf, northOnPlan } from '../src/lib/greenhouseLayout.ts';
import { createOutbox, newClientId, isServerPhoto } from '../src/lib/ghOutbox.ts';
import { positionsOf as serverPositions } from '../../server/src/lib/greenhouse/layout.js';

let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };

const good = { crop_id: 'abc', row_id: 'R3', recorded_count: '12', photo_url: '/uploads/u-1.jpg' };
ok(countProblem(good) === '', 'a complete count can be sent');
ok(countProblem({ ...good, recorded_count: 0 }) === '' && countProblem({ ...good, recorded_count: '0' }) === '', 'zero fruit is a valid count');
ok(/crop/i.test(countProblem({ ...good, crop_id: '' })), 'a crop is needed');
ok(/row/i.test(countProblem({ ...good, row_id: '' })) && /row/i.test(countProblem({ ...good, row_id: '   ' })), 'a row ID is needed, and spaces do not count');
for (const bad of ['', '-1', '2.5', 'abc', undefined, null]) ok(/number of fruit/i.test(countProblem({ ...good, recorded_count: bad })), `"${bad}" is not a valid number of fruit`);
ok(/photo/i.test(countProblem({ ...good, photo_url: '' })) && /photo/i.test(countProblem({ ...good, photo_url: null })), 'a photo is needed');
ok(countProblem({ ...good, crop_id: '', row_id: '' }).length > 0, 'the first missing thing is reported');

for (const k of ['match', 'close', 'mismatch', 'inconclusive', 'not_checked', 'failed']) ok(VERDICTS[k] && VERDICTS[k].label && VERDICTS[k].tone && VERDICTS[k].icon, `the result "${k}" has a label, a colour and an icon`);
ok(VERDICTS.match.tone === 'success' && VERDICTS.mismatch.tone === 'danger' && VERDICTS.inconclusive.tone === 'warning', 'matches are green, mismatches red, and "not sure" amber');
ok(['red', 'orange', 'yellow', 'purple', 'green'].every((c) => /^#[0-9A-F]{6}$/i.test(COLOR_HEX[c])), 'every fruit colour has a swatch');

const house = { name: 'House 1', length_m: '30', width_m: '8', rows: '6', plants_per_row: '40' };
ok(houseProblem(house) === '', 'a complete greenhouse layout can be sent');
ok(/name/i.test(houseProblem({ ...house, name: '  ' })), 'a greenhouse needs a name');
for (const [k, bad] of [['length_m', ''], ['length_m', '0'], ['length_m', '501'], ['width_m', '-2'], ['width_m', 'abc'], ['rows', '0'], ['rows', '2.5'], ['rows', '101'], ['plants_per_row', ''], ['plants_per_row', '301']]) ok(houseProblem({ ...house, [k]: bad }) !== '', `${k} "${bad}" is refused`);
ok(/6000/.test(houseProblem({ ...house, rows: '100', plants_per_row: '100' })), 'more than 6000 plants is refused');
ok(heatColor(0, 10) === '#fff3e0' && heatColor(10, 10) === '#c62828' && heatColor(5, 0) === '#fff3e0', 'the fruit heat colour runs from pale to red');
ok(markerColor({ latest: null }, 'status', 10) === STATUS_COLOR.none, 'a plant never counted is grey');
ok(markerColor({ latest: { recorded_count: 4, status: 'mismatch' } }, 'status', 10) === STATUS_COLOR.mismatch, 'a plant is coloured by its photo check');
ok(markerColor({ latest: { recorded_count: 10, status: 'match' } }, 'fruit', 10) === '#c62828', 'or by how much fruit it has');

/* ---- the second round: several photos, sizes, frozen and deactivated plants, roles, the shape of the house */
ok(countProblem({ ...good, photo_url: undefined, photo_urls: ['/uploads/a.jpg', '/uploads/b.jpg'] }) === '' && /photo/i.test(countProblem({ ...good, photo_url: undefined, photo_urls: [] })), 'a count can have several photos, and needs at least one');
ok(/12/.test(countProblem({ ...good, photo_urls: Array.from({ length: 13 }, (_x, i) => `/uploads/p${i}.jpg`) })), 'more than 12 photos for one plant are refused');
ok(JSON.stringify(FRUIT_SIZES.map((x) => x.value)) === '["all","small","medium","large"]', 'a count is for all sizes, or small, medium or large fruit');
ok(markerColor({ state: 'frozen', latest: { recorded_count: 5, status: 'match' } }, 'status', 10) === STATUS_COLOR.frozen && markerColor({ state: 'inactive', latest: null }, 'fruit', 10) === STATUS_COLOR.inactive, 'a frozen plant is light blue and a deactivated position dark grey, whatever the colouring');
ok(houseProblem({ ...house, plants_per_row: '0' }) === '' && houseProblem({ ...house, plants_per_row: '301' }) !== '', 'a row may have no plants yet (positions are added later), but not more than 300');
const ids = (role) => TABS_BY_ROLE[role].map((x) => x.id).join(',');
ok(ids('owner') === 'dashboard,layout,counts,disease,harvest,alerts,crops,team', 'the farm owner has every tab');
ok(ids('manager') === 'dashboard,disease,harvest,alerts,counts' && !TABS_BY_ROLE.manager.some((x) => x.id === 'layout'), 'the farm manager has records and the disease report, and no plan or 3D');
ok(ids('collector') === 'today,layout,counts' && !TABS_BY_ROLE.collector.some((x) => ['dashboard', 'disease', 'team', 'crops', 'alerts', 'harvest'].includes(x.id)), 'the data collector has the plan and recording, and nothing else');
ok(!TABS_BY_ROLE.collector.some((x) => x.id === 'harvest'), 'the data collector has no harvest value');
const shaped = { length_m: 20, width_m: 9, rows: 3, plants_per_row: 6, pattern: 'zigzag', row_defs: [{ plants: 4 }, { plants: 6 }, { plants: 3, sub_rows: 2 }] };
const mine = positionsOf(shaped);
ok(mine.length === 16 && totalPositions(shaped) === 16 && rowDefsOf(shaped)[2].sub_rows === 2 && mine.some((p) => p.row_id === 'R3B' && p.plant_label === 'P3'), 'rows of different lengths and a double row give R1 P4, R2 P6 and R3A P1 to R3B P3');
const same = [shaped, { length_m: 10, width_m: 4, rows: 2, plants_per_row: 4, pattern: 'staggered', plant_spacing_m: 1.5, row_spacing_m: 1.2 }, { length_m: 30, width_m: 8, rows: 4, plants_per_row: 9, pattern: 'grid', row_defs: [{ plants: 9 }, { plants: 4, start: 3 }, { plants: 5, sub_rows: 2 }, { plants: 9 }] }].every((h) => {
  const a = positionsOf(h);
  const b = serverPositions(h);
  return a.length === b.length && a.every((q, i) => q.row_id === b[i].row_id && q.plant_label === b[i].plant_label && q.x === b[i].x && q.z === b[i].z);
});
ok(same, 'the phone places every plant exactly where the server does');
const [nx, nz] = northOnPlan(90);
ok(Math.abs(nx + 1) < 1e-9 && Math.abs(nz) < 1e-9 && northOnPlan(0)[1] === -1, 'north is up when the top wall faces north, and to the left when it faces east');


/* ---- recording without a signal (src/lib/ghOutbox.ts) ---- */
console.log('offline queue');
const net = (m = 'No internet connection') => Object.assign(new Error(m), { network: true });
const http = (status, m) => Object.assign(new Error(m || `HTTP ${status}`), { status });
function rig(overrides = {}) {
  const w = { store: [], saved: 0, uploads: [], posts: [], discarded: [], seq: 0, tick: 0, ...overrides.world };
  const deps = {
    load: async () => JSON.parse(JSON.stringify(w.store)),
    save: async (items) => { w.store = JSON.parse(JSON.stringify(items)); w.saved += 1; },
    upload: overrides.upload || (async (uri) => { w.uploads.push(uri); return `/uploads/u1-${(w.seq += 1)}.jpg`; }),
    post: overrides.post || (async (farm, body) => { w.posts.push({ farm, body }); return { id: 'x' }; }),
    discard: async (uri) => { w.discarded.push(uri); },
    isNetwork: (e) => !!e?.network,
    statusOf: (e) => e?.status,
    messageOf: (e) => e?.message || '',
    now: () => 1_700_000_000_000 + (w.tick += 1) * 1000,
  };
  return { w, deps, box: createOutbox(deps) };
}
const rec = (n, photos = ['file:///a.jpg'], extra = {}) => ({ user: 'u1', farm: '', place: `House A R1 P${n}`, body: { crop_id: 'c', greenhouse: 'House A', row_id: 'R1', plant_label: `P${n}`, recorded_count: 10 + n, count_date: '2026-11-20' }, photos, ...extra });

{
  const id = newClientId();
  ok(/^[A-Za-z0-9_-]{8,64}$/.test(id) && newClientId() !== newClientId(), 'a count id is 8 to 64 safe characters, and different each time');
  ok(isServerPhoto('/uploads/u-1.jpg') && isServerPhoto('https://x/y.jpg') && !isServerPhoto('file:///data/p.jpg') && !isServerPhoto('content://media/1'), 'a photo on the server is told from a file on the phone');
}
{
  const { w, box } = rig({ upload: async () => { throw net(); } });
  const a = await box.add(rec(1)); const b = await box.add(rec(2));
  const r = await box.flush('u1');
  ok(r.stopped === 'network' && r.sent === 0 && (await box.list('u1')).length === 2, 'with no signal nothing is sent and nothing is lost');
  ok(w.store.length === 2 && w.store[0].id === a.id && w.store[1].id === b.id && w.store.every((q) => q.status === 'waiting'), 'the queue is saved on the phone, oldest first');
}
{
  const { w, box } = rig();
  await box.add(rec(1, ['file:///a.jpg', 'file:///b.jpg'])); await box.add(rec(2, ['/uploads/u1-already.jpg']));
  const r = await box.flush('u1');
  ok(r.sent === 2 && r.failed === 0 && r.stopped === null && w.store.length === 0, 'online, everything is sent and the queue empties');
  ok(w.uploads.join() === 'file:///a.jpg,file:///b.jpg' && w.posts[0].body.photo_urls.join() === '/uploads/u1-1.jpg,/uploads/u1-2.jpg' && w.posts[1].body.photo_urls.join() === '/uploads/u1-already.jpg', 'photos are uploaded in order, and a photo already on the server is not uploaded again');
  ok(w.posts[0].body.client_id.length >= 8 && w.posts[0].body.recorded_at && w.posts[0].body.recorded_count === 11 && w.posts[0].body.row_id === 'R1' && w.posts[0].body.photo_url === undefined, 'the count is sent with its own id, the time it was recorded, and the form as filled in');
  ok(w.discarded.join() === 'file:///a.jpg,file:///b.jpg', 'the copies on the phone are deleted once uploaded');
  ok(w.posts[0].body.recorded_at < w.posts[1].body.recorded_at, 'counts keep the order they were recorded in');
}
{
  // the photos reached the server, the connection dropped before the count was saved: the retry must not upload the photos again
  let fail = true;
  const { w, box } = rig({ post: undefined });
  const orig = box;
  const posts = [];
  const r2 = rig({ post: async (farm, body) => { if (fail) throw net(); posts.push(body); return {}; } });
  await r2.box.add(rec(1, ['file:///a.jpg']));
  const first = await r2.box.flush('u1');
  ok(first.stopped === 'network' && r2.w.uploads.length === 1 && r2.w.store[0].photos[0] === '/uploads/u1-1.jpg', 'a photo that was uploaded is remembered even if the count could not be saved');
  fail = false;
  const second = await r2.box.flush('u1');
  ok(second.sent === 1 && r2.w.uploads.length === 1 && posts.length === 1 && posts[0].photo_urls[0] === '/uploads/u1-1.jpg', 'the retry saves the count without uploading the photo again');
}
{
  // the count was saved but the reply was lost: the same id is sent again, and the server answers with the count it already has
  let calls = 0;
  const seen = [];
  const { box } = rig({ post: async (farm, body) => { calls += 1; seen.push(body.client_id); if (calls === 1) throw net(); return { id: 'same' }; } });
  await box.add(rec(1));
  await box.flush('u1');
  await box.flush('u1');
  ok(calls === 2 && seen[0] === seen[1], 'a retry sends the same id, so the server can recognise a count it already saved');
}
{
  const { w, box } = rig({ post: async (farm, body) => { if (body.row_id === 'R1' && body.plant_label === 'P1') throw http(409, 'R1 P1 is deactivated: uprooted.'); w.posts.push(body); return {}; } });
  const bad = await box.add(rec(1)); await box.add(rec(2)); await box.add(rec(3));
  const r = await box.flush('u1');
  const left = await box.list('u1');
  ok(r.sent === 2 && r.failed === 1 && left.length === 1 && left[0].id === bad.id && left[0].status === 'failed' && /deactivated/.test(left[0].error), 'a count the server refuses is kept with the reason and does not block the others');
  ok((await box.flush('u1')).sent === 0 && w.posts.length === 2, 'a failed count is not sent again by itself');
  await box.retry(bad.id);
  ok((await box.list('u1'))[0].status === 'waiting' && (await box.list('u1'))[0].error === '', 'a failed count can be tried again');
  await box.remove(bad.id);
  ok((await box.list('u1')).length === 0 && w.discarded.includes('file:///a.jpg'), 'or deleted, with its photos on the phone');
}
{
  const { box } = rig({ post: async () => { throw http(401, 'expired'); } });
  await box.add(rec(1));
  const r = await box.flush('u1');
  ok(r.stopped === 'auth' && (await box.list('u1'))[0].status === 'waiting', 'an expired session stops the sending and keeps the count');
  const s = rig({ post: async () => { throw http(503, 'down'); } });
  await s.box.add(rec(1)); await s.box.add(rec(2));
  const r5 = await s.box.flush('u1');
  ok(r5.stopped === 'server' && (await s.box.list('u1')).length === 2 && (await s.box.list('u1'))[0].attempts === 1, 'a server that is down stops the sending, counts the try, and keeps everything');
  const lim = rig({ post: async () => { throw http(429, 'slow down'); } });
  await lim.box.add(rec(1));
  ok((await lim.box.flush('u1')).stopped === 'server' && (await lim.box.list('u1'))[0].status === 'waiting', 'too many requests is waited out, not treated as a refusal');
}
{
  const { w, box } = rig();
  await box.add(rec(1)); await box.add({ ...rec(2), user: 'u2' });
  const r = await box.flush('u1');
  ok(r.sent === 1 && (await box.list('u2')).length === 1 && w.posts.length === 1, 'only the signed-in person\'s counts are sent');
}
{
  let release;
  const gate = new Promise((res) => { release = res; });
  const { w, box } = rig({ post: async (farm, body) => { await gate; w.posts?.push?.(body); return {}; } });
  await box.add(rec(1));
  const a = box.flush('u1');
  const b = await box.flush('u1');
  release();
  const aRes = await a;
  ok(b.sent === 0 && aRes.sent === 1 && box.isFlushing() === false, 'two sendings at once do not send a count twice');
}
{
  const first = rig();
  await first.box.add(rec(1)); await first.box.add(rec(2));
  const again = createOutbox(first.deps);
  const list = await again.list('u1');
  ok(list.length === 2 && list[0].place === 'House A R1 P1', 'after the app is closed and opened again the queue is still there');
  let heard = 0;
  const off = again.subscribe(() => { heard += 1; });
  await again.remove(list[0].id);
  off();
  await again.remove(list[1].id);
  ok(heard >= 1, 'the screen is told when the queue changes');
}
{
  const farmSeen = [];
  const { box } = rig({ post: async (farm) => { farmSeen.push(farm); return {}; } });
  await box.add(rec(1, ['/uploads/x.jpg'], { farm: 'owner-9' })); await box.add(rec(2, ['/uploads/x.jpg']));
  await box.flush('u1');
  ok(farmSeen.join() === 'owner-9,', 'each count is saved on the farm it was recorded for');
}

console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
