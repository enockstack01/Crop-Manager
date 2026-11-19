/**
 * Checks the harvest value estimate (healthy fruit, total counted, disease loss, price):
 *
 *   node src/scripts/test-greenhouse-revenue.mjs
 *
 * Pure calculation, no database or network. The numbers are worked out by hand in the comments.
 */
import { estimate, sickFruitOf } from '../lib/greenhouse/revenue.js';

let passed = 0;
let failed = 0;
const ok = (c, name, extra = '') => {
  if (c) { passed += 1; console.log(`  ok   ${name}`); } else { failed += 1; console.log(`  FAIL ${name} ${extra}`); }
};

// one house: 2 rows x 5 plants = 10 positions; R1 P5 is deactivated, R2 P1 is frozen
const house = { _id: 'h1', name: 'House A', length_m: 10, width_m: 4, rows: 2, plants_per_row: 5, positions: { 'R1|P5': { state: 'inactive' }, 'R2|P1': { state: 'frozen' } } };
const tomato = { _id: 't', name: 'Tomato', fruit_weight_g: 100, price_per_kg: 2, currency: 'USD' };
const pepper = { _id: 'p', name: 'Pepper', fruit_weight_g: 200, price_per_kg: null, currency: 'USD' };
const cnt = (row, plant, n, health, crop = 't', extra = {}) => ({ crop_id: crop, greenhouse: 'House A', row_id: row, plant_label: plant, recorded_count: n, verification: health ? { health } : {}, ...extra });
const healthy = { status: 'healthy', sick_fruit: 0, checked_fruit: 10 };
const sick = (s, c) => ({ status: 'sick', sick_fruit: s, checked_fruit: c });

console.log('1. one plant');
ok(sickFruitOf(cnt('R1', 'P1', 10, healthy)).sick === 0 && !sickFruitOf(cnt('R1', 'P1', 10, healthy)).plantSick, 'a healthy plant has no sick fruit');
ok(sickFruitOf(cnt('R1', 'P1', 40, sick(3, 10))).sick === 12, 'a share of the checked fruit applies to the whole count (3 of 10 checked, 40 counted: 12)');
ok(sickFruitOf(cnt('R1', 'P1', 5, sick(8, 10))).sick === 4, 'never more sick fruit than were counted', String(sickFruitOf(cnt('R1', 'P1', 5, sick(8, 10))).sick));
ok(sickFruitOf(cnt('R1', 'P1', 10, null)).checked === false, 'no health check is told apart from healthy');

console.log('2. the totals');
// R1 P1: 10 healthy. R1 P2: 20 fruit, 5 of 10 checked sick -> 10 sick, at risk 20% of the other 10 = 2. R2 P1 (frozen): 10 healthy. R1 P5 (inactive): 99, ignored. R1 P3: 4 fruit, no check.
const counts = [
  cnt('R1', 'P1', 10, healthy), cnt('R1', 'P2', 20, sick(5, 10)), cnt('R2', 'P1', 10, healthy), cnt('R1', 'P5', 99, healthy), cnt('R1', 'P3', 4, null),
  cnt('R1', 'P1', 1, healthy), // an older count of R1 P1 (newest first, so it is ignored)
];
const e = estimate({ houses: [house], counts, crops: [tomato, pepper] });
const T = e.totals;
ok(T.counted_plants === 4 && T.fruit === 44, 'counts the latest count of each active plant (4 plants, 44 fruit; the deactivated one is left out)', JSON.stringify(T));
ok(T.sick_fruit === 10 && T.at_risk_fruit === 2, 'sick fruit 10 and at risk 2', `${T.sick_fruit}/${T.at_risk_fruit}`);
ok(T.healthy_fruit === 32, 'healthy fruit = 44 - 10 - 2 = 32', String(T.healthy_fruit));
ok(T.kg === 4.4 && T.kg_net === 3.2, 'kilograms at 100 g a fruit: 4.4 gross, 3.2 net', `${T.kg}/${T.kg_net}`);
ok(T.sick_plants === 1 && T.unchecked_plants === 1, 'one sick plant, one plant without a check');
ok(e.notes.some((n) => /no health check/.test(n)), 'says when plants were not health checked');
const usd = e.money.find((m) => m.currency === 'USD');
ok(usd.gross === 8.8 && usd.net === 6.4 && usd.loss === 2.4, 'money at 2 per kg: gross 8.8, net 6.4, loss 2.4', JSON.stringify(usd));

console.log('3. best, expected and worst');
// best: 44 - 10 = 34 fruit -> 6.8. expected 32 -> 6.4. worst: the sick plant loses all 20 -> 24 fruit -> 4.8
ok(usd.net_best === 6.8, 'best case 6.8', String(usd.net_best));
ok(usd.net_worst === 4.8, 'worst case loses every fruit of the sick plant: 4.8', String(usd.net_worst));
ok(usd.net_worst < usd.net && usd.net < usd.net_best, 'worst < expected < best');
const none = estimate({ houses: [house], counts, crops: [tomato], risk: 0 });
ok(none.totals.at_risk_fruit === 0 && none.totals.healthy_fruit === 34, 'with risk 0 nothing is at risk');
const all = estimate({ houses: [house], counts, crops: [tomato], risk: 1 });
ok(all.totals.healthy_fruit === 24, 'with risk 100 per cent the whole sick plant is lost', String(all.totals.healthy_fruit));
ok(estimate({ houses: [house], counts, crops: [tomato], risk: 'x' }).risk === 0.2 && estimate({ houses: [house], counts, crops: [tomato], risk: 7 }).risk === 1, 'a bad risk falls back to 20 per cent, a big one is capped at 100');

console.log('4. the rest of the house');
// 10 positions - 1 inactive = 9 active, 4 counted -> 5 not counted. Average 44/4 = 11 fruit. Keep ratio 32/44.
const H = e.by_house[0];
ok(H.active_positions === 9 && H.counted_plants === 4 && H.uncounted_plants === 5, 'nine active plants, four counted, five not counted yet', JSON.stringify([H.active_positions, H.counted_plants, H.uncounted_plants]));
ok(H.frozen_plants === 1, 'a frozen plant is counted and shown as frozen');
ok(H.projected.fruit === 55 && H.projected.avg_per_plant === 11, 'the five plants are given 11 fruit each: 55', JSON.stringify(H.projected));
ok(H.projected.fruit_net === 40, 'with the same loss as the counted plants: 55 x 32/44 = 40', String(H.projected.fruit_net));
ok(T.whole_fruit === 99 && T.whole_fruit_net === 72, 'whole greenhouse: 99 fruit, 72 expected to sell', `${T.whole_fruit}/${T.whole_fruit_net}`);
ok(usd.whole_net === 14.4 && usd.projected_net === 8, 'whole greenhouse worth 14.4 (6.4 counted + 8.0 projected)', JSON.stringify(usd));

console.log('5. prices and crops');
const mixed = estimate({ houses: [house], counts: [...counts, cnt('R2', 'P2', 10, healthy, 'p')], crops: [tomato, pepper] });
ok(mixed.notes.some((n) => /No price per kg for Pepper/.test(n)), 'a crop without a price is named and left out of the money');
ok(mixed.money.find((m) => m.currency === 'USD').gross === 8.8, 'the unpriced pepper adds no money');
ok(mixed.totals.kg === 6.4, 'but its weight still counts: 4.4 + 10 x 0.2 = 6.4 kg', String(mixed.totals.kg));
ok(mixed.by_crop.length === 2 && mixed.by_crop[0].name === 'Tomato', 'one row per crop');
const rwf = estimate({ houses: [house], counts: [cnt('R1', 'P1', 10, healthy)], crops: [{ ...tomato, currency: 'RWF', price_per_kg: 1000 }] });
ok(rwf.money.length === 1 && rwf.money[0].currency === 'RWF' && rwf.money[0].gross === 1000, 'money is kept per currency (10 x 100 g x 1000 = 1000 RWF)', JSON.stringify(rwf.money));

console.log('6. edge cases');
const empty = estimate({ houses: [house], counts: [], crops: [tomato] });
ok(empty.totals.fruit === 0 && empty.by_house[0].projected === null && empty.money.length === 0, 'nothing counted: zero, nothing to project from');
ok(estimate({ houses: [house], counts, crops: [tomato], greenhouse: 'Other' }).by_house.length === 0, 'a greenhouse filter that matches nothing');
ok(estimate({ houses: [house], counts: [cnt('R1', 'P1', 10, healthy, 'gone')], crops: [tomato] }).totals.fruit === 0, 'a count of a removed crop is ignored');
const part = estimate({ houses: [house], counts: [cnt('R1', 'P1', 10, healthy, 't', { fruit_size: 'small' })], crops: [tomato] });
ok(part.notes.some((n) => /one fruit size/.test(n)), 'warns when a count is for one fruit size only');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
