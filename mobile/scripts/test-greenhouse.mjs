/**
 * Checks the rules of the greenhouse tab on the phone (src/lib/greenhouseRules.ts): what a fruit count needs before it can be sent,
 * and how each result of the photo check is shown.
 *
 *   node mobile/scripts/test-greenhouse.mjs
 */
import { countProblem, VERDICTS, COLOR_HEX } from '../src/lib/greenhouseRules.ts';

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

console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
