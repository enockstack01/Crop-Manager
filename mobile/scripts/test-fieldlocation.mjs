/**
 * Checks the rules for the exact point of a field on the phone (src/lib/coordinates.ts): the same cases as the server.
 *
 *   node mobile/scripts/test-fieldlocation.mjs
 */
import { coordinateError, sixDecimals, ROUGH_METRES } from '../src/lib/coordinates.ts';

let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };

ok(coordinateError(-1.95, 30.06) === null, 'a real point is accepted');
ok(coordinateError('-1.950000', '30.060000') === null, 'numbers typed into a form (text) are accepted');
ok(coordinateError('', '') !== null && coordinateError(null, undefined) !== null, 'empty coordinates are refused');
ok(coordinateError(-1.95, '') !== null && coordinateError('', 30.06) !== null, 'one missing coordinate is refused');
ok(coordinateError(91, 30) !== null && coordinateError(-91, 30) !== null, 'a latitude beyond 90 is refused');
ok(coordinateError(10, 181) !== null && coordinateError(10, -181) !== null, 'a longitude beyond 180 is refused');
ok(coordinateError(90, 180) === null && coordinateError(-90, -180) === null, 'the edges of the world are accepted');
ok(coordinateError(0, 0) !== null, '0, 0 is refused');
ok(coordinateError(0, 30) === null && coordinateError(-1, 0) === null, 'a point on the equator or the meridian alone is fine');
ok(coordinateError('abc', 'def') !== null, 'text that is not a number is refused');
ok(sixDecimals(-1.9500004999) === -1.95 && sixDecimals(30.0600005) === 30.060001, 'positions are rounded to six decimals (about 10 cm)', `${sixDecimals(-1.9500004999)} ${sixDecimals(30.0600005)}`);
ok(ROUGH_METRES === 100, 'a reading rougher than 100 metres is flagged to the person');

console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
