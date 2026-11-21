/**
 * Checks the theft and loss alerts and the harvest value history:
 *
 *   node src/scripts/test-greenhouse-alerts.mjs
 *
 * Pure calculation, no database or network.
 */
import { theftAlerts } from '../lib/greenhouse/alerts.js';
import { history } from '../lib/greenhouse/revenue.js';

let passed = 0;
let failed = 0;
const ok = (c, name, extra = '') => {
  if (c) { passed += 1; console.log(`  ok   ${name}`); } else { failed += 1; console.log(`  FAIL ${name} ${extra}`); }
};
const TODAY = '2026-11-20';
const d = (n) => new Date(Date.parse(`${TODAY}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
let n = 0;
const mk = (row, plant, daysAgo, rec, det, status, extra = {}) => ({
  _id: `c${(n += 1)}`, crop_id: 't', crop_name: 'Tomato', greenhouse: 'House A', row_id: row, plant_label: plant, count_date: d(daysAgo), recorded_count: rec, fruit_size: 'all',
  entered_by: 'u1', entered_by_name: 'Alice', verification: det == null ? {} : { detected: det, status, confidence: 'high' }, ...extra,
});
const run = (counts, opts) => theftAlerts({ counts, today: TODAY, opts });
const one = (counts, kind) => run(counts).alerts.filter((a) => a.kind === kind);

console.log('1. the photo shows more than was recorded');
const u1 = one([mk('R1', 'P1', 1, 8, 14, 'mismatch')], 'under_recorded');
ok(u1.length === 1 && u1[0].difference === 6 && u1[0].severity === 'medium' && /14 fruit but 8/.test(u1[0].message), 'recorded 8, photo 14: an alert, medium', JSON.stringify(u1[0]));
ok(one([mk('R1', 'P1', 1, 5, 14, 'mismatch')], 'under_recorded')[0].severity === 'high', 'recorded 5, photo 14 (under half): high');
ok(one([mk('R1', 'P1', 1, 9, 11, 'mismatch')], 'under_recorded').length === 0, 'a difference of 2 is not an alert');
ok(one([mk('R1', 'P1', 1, 20, 14, 'mismatch')], 'under_recorded').length === 0, 'recording MORE than the photo shows is not this alert');
ok(one([{ ...mk('R1', 'P1', 1, 5, 14, 'mismatch'), verification: { detected: 14, status: 'mismatch', confidence: 'low' } }], 'under_recorded').length === 0, 'a photo the counter was not sure about raises nothing');
ok(one([mk('R1', 'P1', 1, 5, 14, 'mismatch', { fruit_size: 'small' })], 'under_recorded').length === 0, 'a count of one fruit size only is not compared');
ok(one([mk('R1', 'P1', 40, 5, 14, 'mismatch')], 'under_recorded').length === 0, 'old counts are outside the 30-day window');

console.log('2. a fall between two counts of the same plant');
const f1 = one([mk('R2', 'P1', 0, 8, null), mk('R2', 'P1', 10, 20, null)], 'fall');
ok(f1.length === 1 && f1[0].drop === 12 && f1[0].drop_pct === 60 && f1[0].severity === 'high' && f1[0].days === 10 && f1[0].basis === 'recorded', 'recorded 20 to 8 in 10 days: a 60 per cent fall, high', JSON.stringify(f1[0]));
ok(one([mk('R2', 'P1', 0, 13, null), mk('R2', 'P1', 10, 20, null)], 'fall')[0].severity === 'medium', '20 to 13 (35 per cent): medium');
ok(one([mk('R2', 'P1', 0, 15, null), mk('R2', 'P1', 10, 20, null)], 'fall').length === 0, '20 to 15 (25 per cent) is within normal');
ok(one([mk('R2', 'P1', 0, 8, null), mk('R2', 'P1', 25, 20, null)], 'fall').length === 0, 'counts more than 21 days apart: a harvest in between is expected');
ok(one([mk('R2', 'P1', 0, 1, null), mk('R2', 'P1', 10, 4, null)], 'fall').length === 0, 'a plant with fewer than 5 fruit is too small to judge');
ok(one([mk('R2', 'P1', 0, 8, null, undefined, { crop_id: 'p' }), mk('R2', 'P1', 10, 20, null)], 'fall').length === 0, 'a different crop on the same position is not compared');
ok(one([mk('R2', 'P1', 0, 8, null), mk('R2', 'P2', 10, 20, null)], 'fall').length === 0, 'different plants are not compared');
const same = one([mk('R2', 'P1', 5, 8, null), mk('R2', 'P1', 5, 20, null)], 'fall');
ok(same.length === 0, 'two counts on the same day are not a fall');
const three = one([mk('R3', 'P1', 0, 6, null), mk('R3', 'P1', 7, 12, null), mk('R3', 'P1', 14, 20, null)], 'fall');
ok(three.length === 2 && three.map((a) => a.drop).join() === '6,8', 'every fall in a run of counts is found, newest first', JSON.stringify(three.map((a) => a.drop)));

console.log('3. the photo shows fewer fruit but the number written down did not follow');
const p1 = one([mk('R4', 'P1', 0, 20, 10, 'mismatch'), mk('R4', 'P1', 8, 20, 20, 'match')], 'fall');
ok(p1.length === 1 && p1[0].basis === 'photo' && p1[0].severity === 'high' && /recorded number stayed at 20/.test(p1[0].message), 'photo 20 to 10 while the record stayed 20: high, and says so', JSON.stringify(p1[0]));
const both = one([mk('R4', 'P2', 0, 8, 7, 'close'), mk('R4', 'P2', 8, 20, 20, 'match')], 'fall');
ok(both.length === 1 && both[0].severity === 'high' && /photos agree/.test(both[0].message), 'recorded and photo both fell: high, the photos agree');

console.log('4. explaining an alert');
const acked = run([{ ...mk('R2', 'P1', 0, 8, null), alerts_ack: { fall: { reason: 'harvested on Tuesday', by: 'u9' } } }, mk('R2', 'P1', 10, 20, null), mk('R5', 'P1', 1, 5, 14, 'mismatch')]);
ok(acked.summary.total === 2 && acked.summary.open === 1 && acked.summary.explained === 1 && acked.alerts.find((a) => a.kind === 'fall').ack.reason === 'harvested on Tuesday', 'an explained alert stays in the list but stops counting as open', JSON.stringify(acked.summary));
const sorted = run([mk('R8', 'P1', 1, 8, 14, 'mismatch'), mk('R8', 'P2', 3, 5, 14, 'mismatch')]).alerts;
ok(sorted.length === 2 && sorted[0].severity === 'high' && sorted[1].severity === 'medium', 'alerts are listed high first, even when the medium one is newer');

console.log('5. a person who often records less than the photos show');
const mixed = [];
for (let i = 0; i < 6; i += 1) mixed.push(mk('R6', `P${i + 1}`, i, i < 3 ? 5 : 12, 12, i < 3 ? 'mismatch' : 'match', { entered_by: 'u2', entered_by_name: 'Bob' }));
for (let i = 0; i < 6; i += 1) mixed.push(mk('R7', `P${i + 1}`, i, 12, 12, 'match'));
const people = run(mixed).people;
const bob = people.find((p) => p.entered_by === 'u2');
ok(bob.decided === 6 && bob.under === 3 && bob.under_share === 50 && bob.flagged === true, 'Bob: 3 of 6 counts below the photo (50 per cent) is flagged', JSON.stringify(bob));
ok(people.find((p) => p.entered_by === 'u1').flagged === false, 'Alice, with none below, is not');
ok(run(mixed.slice(0, 3)).people.every((p) => !p.flagged), 'fewer than 5 counts are not enough to flag anyone');

console.log('6. the harvest value over the weeks');
const house = { _id: 'h1', name: 'House A', length_m: 10, width_m: 4, rows: 2, plants_per_row: 5, positions: {} };
const tomato = { _id: 't', name: 'Tomato', fruit_weight_g: 100, price_per_kg: 10, currency: 'USD' };
const hl = (st, s, c) => ({ status: st, sick_fruit: s, checked_fruit: c });
const cs = [
  mk('R1', 'P1', 1, 20, 20, 'match', { verification: { health: hl('sick', 5, 10), status: 'match', detected: 20, confidence: 'high' } }), mk('R1', 'P2', 2, 20, 20, 'match', { verification: { health: hl('healthy', 0, 10) } }),
  mk('R1', 'P1', 15, 10, 10, 'match', { verification: { health: hl('healthy', 0, 10) } }),
];
const hist = history({ houses: [house], counts: cs, crops: [tomato], weeks: 4, today: TODAY });
ok(hist.length === 4 && hist[0].week < hist[3].week && hist[3].as_of === TODAY, 'four weeks, oldest first, the last one ends today', JSON.stringify(hist.map((w) => w.week)));
ok(hist[0].fruit === 0 || hist[0].fruit === 10, 'a week uses only the counts made by then');
ok(hist[3].fruit === 40 && hist[3].sick_plants === 1 && hist[3].loss_share_pct > 0, 'the latest week uses the newest count of each plant: 20 + 20 fruit, one sick plant', JSON.stringify(hist[3]));
ok(hist[2].fruit < hist[3].fruit && hist[2].sick_plants === 0, 'earlier, before the sick count, there was no disease');
ok(hist[3].money[0].currency === 'USD' && hist[3].money[0].net < hist[3].money[0].gross, 'the money follows, with the disease loss taken off');
ok(history({ houses: [house], counts: [], crops: [tomato], weeks: 3, today: TODAY }).every((w) => w.fruit === 0), 'no counts: a flat zero line');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
