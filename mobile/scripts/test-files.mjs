/**
 * Checks how big a photo is sent and how an exported file is named (src/lib/photoPlan.ts, src/lib/fileName.ts). No phone needed:
 *
 *   node mobile/scripts/test-files.mjs
 */
import { planShrink, MAX_SIDE } from '../src/lib/photoPlan.ts';
import { fileNameFor } from '../src/lib/fileName.ts';

let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('1. which photos are shrunk before sending');
ok(same(planShrink(4000, 3000, 9_000_000), { resize: { width: MAX_SIDE } }), 'a 12 MP landscape photo is cut to 1600 px wide', JSON.stringify(planShrink(4000, 3000)));
ok(same(planShrink(3000, 4000, 9_000_000), { resize: { height: MAX_SIDE } }), 'a portrait photo is cut to 1600 px tall');
ok(same(planShrink(8160, 6120, 14_000_000), { resize: { width: MAX_SIDE } }), 'a 50 MP photo too');
ok(planShrink(1280, 960, 400_000) === null, 'a small photo is sent as it is');
ok(planShrink(1600, 1200, 800_000) === null, 'a photo exactly at the limit is not touched');
ok(planShrink(1200, 900, 9_000_000) !== null && !('resize' in planShrink(1200, 900, 9_000_000)), 'a small picture in a huge file is only re-compressed, never enlarged');
ok(planShrink(undefined, undefined, 500_000) === null, 'with no size known and a small file nothing is done');
ok(planShrink(0, 0, 8_000_000) !== null, 'with no size known and a huge file it is re-compressed');
ok(planShrink(1601, 100, 50_000) !== null, 'a very wide strip is still cut');

console.log('2. readable file names');
const day = new Date(2026, 10, 10); // 10 November 2026
ok(fileNameFor('Season Report', 'pdf', day) === 'season-report-2026-11-10.pdf', 'a title becomes a clean name', fileNameFor('Season Report', 'pdf', day));
ok(fileNameFor('Récolte: maïs & haricots', 'xlsx', day) === 'recolte-mais-haricots-2026-11-10.xlsx', 'accents and symbols are removed', fileNameFor('Récolte: maïs & haricots', 'xlsx', day));
ok(fileNameFor('', 'csv', day) === 'cropmanager-2026-11-10.csv', 'an empty title still gives a name');
ok(fileNameFor('???', 'pdf', day) === 'cropmanager-2026-11-10.pdf', 'a title with no letters too');
ok(fileNameFor('Report', '.pdf', day) === 'report-2026-11-10.pdf', 'a dot before the extension is not doubled');
ok(fileNameFor('x'.repeat(200), 'pdf', day).length <= 50 + '-2026-11-10.pdf'.length, 'a very long title is shortened');
ok(!/[\\/:*?"<>|\s]/.test(fileNameFor('a/b\\c:d*e?f"g<h>i|j k', 'pdf', day)), 'no character a phone file system refuses');
ok(fileNameFor('Ukuvuna kwa Mahindi', 'pdf', day) === 'ukuvuna-kwa-mahindi-2026-11-10.pdf', 'any language written with letters works');

console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
