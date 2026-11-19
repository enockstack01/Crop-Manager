/**
 * Checks the rules of the greenhouse tab on the phone (src/lib/greenhouseRules.ts): what a fruit count needs before it can be sent,
 * and how each result of the photo check is shown.
 *
 *   node mobile/scripts/test-greenhouse.mjs
 */
import { countProblem, VERDICTS, COLOR_HEX, houseProblem, heatColor, markerColor, STATUS_COLOR, FRUIT_SIZES, TABS_BY_ROLE } from '../src/lib/greenhouseRules.ts';
import { positionsOf, totalPositions, rowDefsOf, northOnPlan } from '../src/lib/greenhouseLayout.ts';
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
ok(ids('owner') === 'dashboard,layout,counts,disease,harvest,crops,team', 'the farm owner has every tab');
ok(ids('manager') === 'dashboard,disease,harvest,counts' && !TABS_BY_ROLE.manager.some((x) => x.id === 'layout'), 'the farm manager has records and the disease report, and no plan or 3D');
ok(ids('collector') === 'layout,counts' && !TABS_BY_ROLE.collector.some((x) => ['dashboard', 'disease', 'team', 'crops'].includes(x.id)), 'the data collector has the plan and recording, and nothing else');
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

console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
