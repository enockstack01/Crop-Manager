/**
 * Checks the phone copy of the plain-text cleaner (src/lib/plainText.ts): the same cases as the server and web copies.
 *
 *   node mobile/scripts/test-plaintext.mjs
 */
import { plainText, plainDeep } from '../src/lib/plainText.ts';

let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };

const CASES = [
  ['markdown bold and headings', '## Plan\n**Plant early** and __weed__ twice.', 'Plan\nPlant early and weed twice.'],
  ['italic and code', 'Use *clean* seed from `local` shops.', 'Use clean seed from local shops.'],
  ['long dash between clauses', 'Maize needs rain — plant when the rains are steady.', 'Maize needs rain, plant when the rains are steady.'],
  ['long dash without spaces', 'Plant early—weed twice.', 'Plant early, weed twice.'],
  ['en dash between clauses', 'Water daily – morning or evening.', 'Water daily, morning or evening.'],
  ['spaced hyphen between words', 'Scout weekly - look under the leaves.', 'Scout weekly, look under the leaves.'],
  ['double hyphen', 'Check the stock -- it is low.', 'Check the stock, it is low.'],
  ['dash after a full stop is just removed', 'Done. — Next, spray.', 'Done. Next, spray.'],
  ['number range with a long dash', 'Space rows 80–100 cm apart.', 'Space rows 80 to 100 cm apart.'],
  ['number range with a hyphen is kept', 'Plant 5-7 cm deep.', 'Plant 5-7 cm deep.'],
  ['hyphen inside a word is kept', 'Use a maize-bean mix and follow-up visits.', 'Use a maize-bean mix and follow-up visits.'],
  ['a sum is kept', 'You have 10 - 5 = 5 bags left.', 'You have 10 - 5 = 5 bags left.'],
  ['negative number is kept', 'The balance is -250 this month.', 'The balance is -250 this month.'],
  ['date is kept', 'Harvest on 2026-11-12.', 'Harvest on 2026-11-12.'],
  ['dash bullets keep one item per line', '- Clear weeds\n- Loosen soil\n- Sow seed', 'Clear weeds\nLoosen soil\nSow seed'],
  ['star and dot bullets', '* First\n• Second', 'First\nSecond'],
  ['numbered list is kept', '1. Clear the field\n2. Sow the seed', '1. Clear the field\n2. Sow the seed'],
  ['emoji and ticks removed', 'Good job ✅ keep going 🌱', 'Good job keep going'],
  ['arrows become commas', 'Rain → plant → weed', 'Rain, plant, weed'],
  ['rule lines removed', 'Plan\n---\nSteps', 'Plan\nSteps'],
  ['table row', '| Crop | Area |', 'Crop, Area'],
  ['blank lines collapsed', 'One\n\n\n\nTwo', 'One\n\nTwo'],
  ['space before punctuation', 'Wait , then spray .', 'Wait, then spray.'],
  ['plain sentences untouched', 'Plant maize at the start of the rains. Weed after two weeks.', 'Plant maize at the start of the rains. Weed after two weeks.'],
  ['a leading long dash', '— Start now.', 'Start now.'],
];
for (const [label, input, want] of CASES) {
  const got = plainText(input);
  ok(got === want, label, `
       got:  ${JSON.stringify(got)}
       want: ${JSON.stringify(want)}`);
}
const deep = plainDeep({ title: '**Fall armyworm** — damage', n: 3, ok: true, items: ['- one', { detail: 'a – b' }], module: 'crop-cycles', none: null });
ok(deep.title === 'Fall armyworm, damage' && deep.n === 3 && deep.ok === true && deep.items[0] === 'one' && deep.items[1].detail === 'a, b' && deep.module === 'crop-cycles' && deep.none === null, 'a whole answer is cleaned and numbers, flags and ids are left alone');
ok(plainText('') === '' && plainText(null) === null, 'empty values pass through');
// what the small on-phone model tends to write
ok(plainText('**Plant early** - then weed. Spacing is 60–90 cm.') === 'Plant early, then weed. Spacing is 60 to 90 cm.', 'a typical offline answer');

console.log(`
${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
