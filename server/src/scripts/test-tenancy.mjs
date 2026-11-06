/**
 * Checks that one farmer can never attach a record to another farmer's data, and that long lists reach the pickers whole:
 *
 *   node src/scripts/test-tenancy.mjs
 *
 * Starts the API itself in test mode (dev-auth header, no Clerk, no AI) and removes everything it creates.
 */
import { spawn } from 'node:child_process';
import { connectDB } from '../config/db.js';
import * as M from '../models/index.js';

const PREFIX = 'tenanttest_';
const A = `${PREFIX}a`;
const B = `${PREFIX}b`;
let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };

await connectDB();
const owned = [M.Profile, M.Farm, M.Field, M.Crop, M.CropCycle, M.Expense, M.Sale, M.InventoryItem, M.InventoryTransaction];
const cleanup = () => Promise.all(owned.map((Model) => Model.deleteMany({ user_id: new RegExp(`^${PREFIX}`) })));
await cleanup();
for (const u of [A, B]) await M.Profile.create({ user_id: u, email: `${u}@tenanttest.local`, email_verified: true, account_status: 'active', is_active: true, onboarded: true });

const port = 5086;
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
const call = (user, method, path, body) =>
  fetch(base + path, { method, headers: { 'x-dev-user': user, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const json = async (r) => { try { return await r.json(); } catch { return {}; } };

try {
  console.log('1. records of one farmer cannot point at another farmer\'s data');
  const farmA = await json(await call(A, 'POST', '/api/farms', { name: 'A farm', location: 'x' }));
  const fieldA = await json(await call(A, 'POST', '/api/fields', { farm_id: farmA.id, name: 'A field', area: 1 }));
  const cropA = await json(await call(A, 'POST', '/api/crops', { name: 'A maize', category: 'Cereal' }));
  ok(!!farmA.id && !!fieldA.id && !!cropA.id, 'the owner can create a farm, a field and a crop');

  const farmB = await json(await call(B, 'POST', '/api/farms', { name: 'B farm', location: 'y' }));
  const fieldB = await json(await call(B, 'POST', '/api/fields', { farm_id: farmB.id, name: 'B field', area: 1 }));
  const cropB = await json(await call(B, 'POST', '/api/crops', { name: 'B beans', category: 'Legume' }));
  ok(!!fieldB.id, 'another farmer can use their own farm');

  const steal = await call(B, 'POST', '/api/fields', { farm_id: farmA.id, name: 'sneaky', area: 1 });
  ok(steal.status === 400 || steal.status === 404, 'a field cannot be created inside someone else\'s farm', `status ${steal.status}`);
  ok((await M.Field.countDocuments({ user_id: B, name: 'sneaky' })) === 0, 'and nothing was saved');

  const cycleBody = (farm, field, crop) => ({ farm_id: farm, field_id: field, crop_id: crop, planting_date: '2026-10-01', status: 'Planned' });
  const stealCycle = await call(B, 'POST', '/api/crop-cycles', cycleBody(farmB.id, fieldA.id, cropB.id));
  ok(stealCycle.status === 400 || stealCycle.status === 404, 'a crop cycle cannot use someone else\'s field', `status ${stealCycle.status}`);
  const stealCrop = await call(B, 'POST', '/api/crop-cycles', cycleBody(farmB.id, fieldB.id, cropA.id));
  ok(stealCrop.status === 400 || stealCrop.status === 404, 'a crop cycle cannot use someone else\'s crop', `status ${stealCrop.status}`);
  const mine = await call(B, 'POST', '/api/crop-cycles', cycleBody(farmB.id, fieldB.id, cropB.id));
  ok(mine.status === 201, 'a crop cycle made of one\'s own records still works', `status ${mine.status}`);
  const cycleB = await json(mine);

  const upd = await call(B, 'PUT', `/api/crop-cycles/${cycleB.id}`, { field_id: fieldA.id });
  ok(upd.status === 400 || upd.status === 404, 'an update cannot move a record onto someone else\'s field', `status ${upd.status}`);
  const after = await json(await call(B, 'GET', `/api/crop-cycles/${cycleB.id}`));
  ok(after.field_id === fieldB.id, 'the record still points at the owner\'s field');
  const clear = await call(B, 'PUT', `/api/crop-cycles/${cycleB.id}`, { variety_id: null, season_id: null, notes: 'ok' });
  ok(clear.status === 200, 'empty optional links are still accepted', `status ${clear.status}`);
  const junk = await call(B, 'PUT', `/api/crop-cycles/${cycleB.id}`, { field_id: 'not-an-id' });
  ok(junk.status === 400 || junk.status === 404, 'a malformed id is refused with a client error', `status ${junk.status}`);
  const stock = await call(B, 'POST', '/api/inventory-transactions', { item_id: (await json(await call(A, 'POST', '/api/inventory-items', { name: 'A seed', category: 'Seed', unit: 'kg', quantity: 5 }))).id, type: 'in', quantity: 1 });
  ok(stock.status === 400 || stock.status === 404, 'a stock movement cannot use someone else\'s item', `status ${stock.status}`);

  console.log('2. long lists reach the pickers whole');
  await M.Expense.insertMany(Array.from({ length: 150 }, (_, i) => ({ user_id: A, category: 'Fuel', description: `row ${i}`, amount: 1, expense_date: '2026-11-01' })));
  const all = await json(await call(A, 'GET', '/api/expenses?perPage=1000'));
  ok(Array.isArray(all.data) && all.data.length === 150, 'perPage=1000 returns all 150 rows', `got ${all.data && all.data.length}`);
  const huge = await json(await call(A, 'GET', '/api/expenses?perPage=100000'));
  ok(huge.data && huge.data.length <= 1000, 'an absurd page size is still capped', `got ${huge.data && huge.data.length}`);
} finally {
  child.kill();
  await new Promise((r) => setTimeout(r, 300));
  await cleanup();
  process.exitCode = failures ? 1 : 0;
  console.log(`\n${passed} passed, ${failures} failed`);
  process.exit();
}
