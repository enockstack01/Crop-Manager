/**
 * The shared rate-limit store:
 *
 *   node src/scripts/test-ratelimit.mjs
 *
 * 1. the counter itself: exact under 50 simultaneous requests, starts a new window when the old one ends, can be reset;
 * 2. two real server instances sharing one limit (a request counted by one is counted by the other), and a limit that survives a restart.
 * Starts its own servers (test mode, no Clerk, no AI) and removes the counters it makes.
 */
import { spawn } from 'node:child_process';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import * as M from '../models/index.js';
import { MongoRateLimitStore } from '../lib/rateLimit.js';

let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await connectDB();
const P = 'rltest_';
const USER = `${P}user`;
const coll = mongoose.connection.collection('ratelimits');
const cleanup = async () => { await coll.deleteMany({ _id: new RegExp(`^(${P}|org-|api\\|${P})`) }); await coll.deleteMany({ _id: new RegExp(P) }); await M.Profile.deleteMany({ user_id: new RegExp(`^${P}`) }); };
await cleanup();

try {
  console.log('1. the shared counter');
  const store = new MongoRateLimitStore(`${P}unit`);
  store.init({ windowMs: 1200 });
  const t0 = Date.now();
  const results = await Promise.all(Array.from({ length: 50 }, () => store.increment('k')));
  const hits = results.map((r) => r.totalHits).sort((a, b) => a - b);
  ok(hits[0] === 1 && hits[49] === 50 && new Set(hits).size === 50, 'fifty simultaneous requests are counted exactly once each', `${hits[0]}..${hits[49]}`);
  ok(new Date(results[0].resetTime).getTime() > t0, 'the window has an end after the first request', String(results[0].resetTime));
  await sleep(1400);
  ok((await store.increment('k')).totalHits === 1, 'a new window starts when the old one has ended');
  await store.decrement('k');
  ok((await store.increment('k')).totalHits === 1, 'a request can be taken back');
  await store.resetKey('k');
  ok((await store.increment('k')).totalHits === 1, 'a counter can be reset');
  const other = new MongoRateLimitStore(`${P}other`);
  other.init({ windowMs: 5000 });
  await other.increment('k');
  ok((await store.increment('k')).totalHits === 2 && (await other.increment('k')).totalHits === 2, 'two limits never share a counter');

  console.log('2. two server instances share one limit');
  await M.Profile.create({ user_id: USER, email: `${USER}@rl.local`, email_verified: true, account_status: 'active', is_active: true, onboarded: true });
  const start = (port) => {
    const child = spawn(process.execPath, ['src/index.js'], {
      cwd: new URL('../../', import.meta.url),
      env: { ...process.env, PORT: String(port), HF_TOKEN: '', AI_MOCK: '1', ALLOW_DEV_AUTH: '1', RATE_LIMIT_STORE: 'mongo' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return child;
  };
  const waitUp = async (port) => { for (let i = 0; i < 180; i += 1) { try { if ((await fetch(`http://localhost:${port}/api/health`)).status < 500) return; } catch { /* not up */ } await sleep(500); } };
  // the organization sign-up route allows 10 attempts a minute per signed-in user
  const attempt = (port) => fetch(`http://localhost:${port}/api/organizations/register`, { method: 'POST', headers: { 'x-dev-user': USER, 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.status);
  let a = start(5087);
  const b = start(5088);
  await Promise.all([waitUp(5087), waitUp(5088)]);
  const statuses = [];
  for (let i = 0; i < 5; i += 1) statuses.push(await attempt(5087));
  for (let i = 0; i < 5; i += 1) statuses.push(await attempt(5088));
  ok(statuses.every((s) => s !== 429), 'ten attempts spread over two instances are all allowed', statuses.join(','));
  ok((await attempt(5087)) === 429, 'the eleventh is refused by the first instance, which only saw five itself');
  ok((await attempt(5088)) === 429, 'and by the second');
  a.kill();
  await sleep(500);
  a = start(5087);
  await waitUp(5087);
  ok((await attempt(5087)) === 429, 'the limit survives a restart');
  a.kill();
  b.kill();
  await sleep(500);
} finally {
  await cleanup();
  console.log(`\n${passed} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}
