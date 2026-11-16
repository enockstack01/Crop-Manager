/**
 * Checks that every field is saved with its exact coordinates and that the weather is read at the field's own point:
 *
 *   node src/scripts/test-fieldlocation.mjs
 *
 * Starts the API itself in test mode (dev-auth header, no Clerk, no AI) and removes everything it creates. The weather service itself is
 * not called: the choice of the point is checked in the code that decides where to look.
 */
import { spawn } from 'node:child_process';
import { connectDB } from '../config/db.js';
import * as M from '../models/index.js';
import { coordinateError } from '../lib/fieldLocation.js';
import { resolveLocation } from '../lib/weather.js';
import { coordinateError as webError } from '../../../client/src/lib/fieldLocation.js';

const PREFIX = 'fieldloctest_';
const U = `${PREFIX}a`;
let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };

await connectDB();
const owned = [M.Profile, M.Farm, M.Field];
const cleanup = () => Promise.all(owned.map((Model) => Model.deleteMany({ user_id: new RegExp(`^${PREFIX}`) })));
await cleanup();
await M.Profile.create({ user_id: U, email: `${U}@fieldloctest.local`, email_verified: true, account_status: 'active', is_active: true, onboarded: true });

const port = 5087;
const child = spawn(process.execPath, ['src/index.js'], {
  cwd: new URL('../../', import.meta.url),
  env: { ...process.env, PORT: String(port), HF_TOKEN: '', AI_MOCK: '1', ALLOW_DEV_AUTH: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const base = `http://localhost:${port}`;
for (let i = 0; i < 180; i += 1) {
  try { if ((await fetch(`${base}/api/health`)).status < 500) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 500));
}
const call = (method, path, body) =>
  fetch(base + path, { method, headers: { 'x-dev-user': U, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const json = async (r) => { try { return await r.json(); } catch { return {}; } };

try {
  console.log('1. the coordinate rule');
  ok(coordinateError(-1.95, 30.06) === null, 'a real point is accepted');
  ok(coordinateError('-1.950000', '30.060000') === null, 'numbers typed into a form (text) are accepted');
  ok(coordinateError('', '') !== null && coordinateError(null, undefined) !== null, 'empty coordinates are refused');
  ok(coordinateError(-1.95, '') !== null, 'one missing coordinate is refused');
  ok(coordinateError(91, 30) !== null && coordinateError(-91, 30) !== null, 'a latitude beyond 90 is refused');
  ok(coordinateError(10, 181) !== null && coordinateError(10, -181) !== null, 'a longitude beyond 180 is refused');
  ok(coordinateError(0, 0) !== null, '0, 0 is refused');
  ok(coordinateError('abc', 'def') !== null, 'text that is not a number is refused');
  const SAMPLES = [[-1.95, 30.06], ['-1.95', '30.06'], ['', ''], [null, undefined], [-1.95, ''], [91, 30], [-91, 30], [10, 181], [10, -181], [0, 0], ['abc', 'def'], [90, 180], [-90, -180]];
  ok(SAMPLES.every(([a, b]) => (coordinateError(a, b) === null) === (webError(a, b) === null)), 'the website uses the same rule as the server');

  console.log('2. a field cannot be saved without its exact point');
  const farm = await json(await call('POST', '/api/farms', { name: 'Loc farm', location: 'Huye' }));
  const none = await call('POST', '/api/fields', { farm_id: farm.id, name: 'No point', area: 1 });
  ok(none.status === 400, 'a new field without coordinates is refused', `status ${none.status}`);
  const noneBody = await json(none);
  ok(/coordinates/i.test(noneBody.message || ''), 'and the message asks for the coordinates', noneBody.message);
  ok((await M.Field.countDocuments({ user_id: U })) === 0, 'and nothing was saved');
  ok((await call('POST', '/api/fields', { farm_id: farm.id, name: 'Blank', area: 1, latitude: '', longitude: '' })).status === 400, 'blank boxes from a form are refused');
  ok((await call('POST', '/api/fields', { farm_id: farm.id, name: 'Far', area: 1, latitude: 120, longitude: 30 })).status === 400, 'an impossible latitude is refused');
  ok((await call('POST', '/api/fields', { farm_id: farm.id, name: 'Zero', area: 1, latitude: 0, longitude: 0 })).status === 400, '0, 0 is refused');
  const good = await call('POST', '/api/fields', { farm_id: farm.id, name: 'North block', area: 2, latitude: -2.6, longitude: 29.74 });
  ok(good.status === 201, 'a field with exact coordinates is saved', `status ${good.status}`);
  const goodBody = await json(good);
  ok(goodBody.latitude === -2.6 && goodBody.longitude === 29.74, 'the coordinates are kept exactly as given');
  const typed = await call('POST', '/api/fields', { farm_id: farm.id, name: 'Typed', area: 1, latitude: '-1.950001', longitude: '30.060002' });
  ok(typed.status === 201 && (await json(typed)).latitude === -1.950001, 'coordinates typed as text are saved as numbers');

  console.log('3. editing a field keeps the rule');
  const clear = await call('PUT', `/api/fields/${goodBody.id}`, { latitude: null, longitude: null });
  ok(clear.status === 400, 'the coordinates cannot be cleared', `status ${clear.status}`);
  ok((await call('PUT', `/api/fields/${goodBody.id}`, { name: 'North block (renamed)', soil_type: 'Loam' })).status === 200, 'other changes need not repeat them');
  const moved = await call('PUT', `/api/fields/${goodBody.id}`, { latitude: -2.61, longitude: 29.75 });
  ok(moved.status === 200 && (await json(moved)).latitude === -2.61, 'the point can be corrected');
  // a field made before this rule has no point: it must get one the next time it is saved
  const legacy = await M.Field.create({ user_id: U, farm_id: farm.id, name: 'Old field', area: 1 });
  ok((await call('PUT', `/api/fields/${legacy.id}`, { notes: 'edited' })).status === 400, 'an older field without coordinates must get them when it is edited');
  ok((await call('PUT', `/api/fields/${legacy.id}`, { notes: 'edited', latitude: -2.0, longitude: 29.9 })).status === 200, 'and is saved once it has them');

  console.log('4. the weather is read at the field\'s own point');
  const f1 = (await M.Field.findOne({ user_id: U, name: 'North block (renamed)' }).lean());
  const f2 = (await M.Field.findOne({ user_id: U, name: 'Typed' }).lean());
  const bare = await M.Field.create({ user_id: U, farm_id: farm.id, name: 'Bare', area: 1 });
  const chosen = await resolveLocation(U, { field_id: String(f2._id) });
  ok(chosen.point && chosen.point.lat === f2.latitude && chosen.point.lon === f2.longitude && chosen.point.source === 'field', 'a chosen field gives exactly its latitude and longitude', JSON.stringify(chosen.point));
  ok(chosen.point.name === 'Typed' && chosen.field && String(chosen.field._id) === String(f2._id), 'and names that field');
  const first = await resolveLocation(U, {});
  ok(first.point && first.point.source === 'field' && first.point.lat === f1.latitude, 'with nothing chosen the first field with coordinates is used', JSON.stringify(first.point));
  const noPoint = await resolveLocation(U, { field_id: String(bare._id) });
  ok(noPoint.point === null && noPoint.reason === 'field_no_coordinates', 'a chosen field without coordinates is not replaced by another place');
  ok(first.fieldOptions.length === 4 && first.fieldOptions.filter((f) => f.has_coordinates).length === 3, 'the field list says which fields have coordinates');
  const pt = await resolveLocation(U, { lat: -1.2, lon: 30.3 });
  ok(pt.point.lat === -1.2 && pt.point.lon === 30.3, 'a given point still works for older apps');
  const api = await call('GET', `/api/weather?field_id=${bare._id}`);
  const apiBody = await json(api);
  ok(api.status === 200 && apiBody.located === false && apiBody.reason === 'field_no_coordinates' && Array.isArray(apiBody.fields), 'the weather answer for a field without coordinates says so and lists the fields', JSON.stringify(apiBody).slice(0, 200));
} finally {
  child.kill();
  await new Promise((r) => setTimeout(r, 300));
  await cleanup();
  process.exitCode = failures ? 1 : 0;
  console.log(`\n${passed} passed, ${failures} failed`);
  process.exit();
}
