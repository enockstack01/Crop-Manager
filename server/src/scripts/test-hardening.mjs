/**
 * Checks the web server's security and speed settings:
 *
 *   node src/scripts/test-hardening.mjs
 *
 * It starts the API itself (twice: normal test mode, and production mode serving the built web app), and signs in with the
 * dev-auth header in the first. Needs client/dist (npm run build) for the production checks. Removes everything it creates.
 * It never calls Clerk, Hugging Face or the AI service.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import sharp from 'sharp';
import { connectDB } from '../config/db.js';
import * as M from '../models/index.js';

const PREFIX = 'hardtest_';
const USER = `${PREFIX}farmer`;
let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };

await connectDB();
const cleanup = async () => {
  await Promise.all([M.Profile.deleteMany({ user_id: new RegExp(`^${PREFIX}`) }), M.Expense.deleteMany({ user_id: new RegExp(`^${PREFIX}`) })]);
  for (const f of fs.readdirSync(new URL('../../uploads/', import.meta.url))) if (f.startsWith(PREFIX)) fs.unlinkSync(new URL(`../../uploads/${f}`, import.meta.url));
};
await cleanup();
await M.Profile.create({ user_id: USER, email: 'farmer@hardtest.local', email_verified: true, account_status: 'active', is_active: true, onboarded: true });

async function withServer(port, env, run) {
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: new URL('../../', import.meta.url),
    env: { ...process.env, PORT: String(port), HF_TOKEN: '', AI_MOCK: '1', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 180; i += 1) {
    try { if ((await fetch(`${base}/api/health`)).status < 500) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  try { await run(base); } finally { child.kill(); await new Promise((r) => setTimeout(r, 300)); }
}

const call = (base, method, path, body, headers = {}) =>
  fetch(base + path, { method, headers: { 'x-dev-user': USER, 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });

console.log('1. headers and filters (test mode)');
await withServer(5082, { ALLOW_DEV_AUTH: '1' }, async (base) => {
  const h = await fetch(`${base}/api/health`);
  const csp = h.headers.get('content-security-policy') || '';
  ok(/default-src 'self'/.test(csp) && /object-src 'none'/.test(csp) && /frame-ancestors 'none'/.test(csp) && /base-uri 'self'/.test(csp), 'a Content Security Policy is sent');
  ok(!/script-src[^;]*'unsafe-inline'/.test(csp) && !/script-src[^;]*'unsafe-eval'/.test(csp), 'scripts may not run inline or through eval');
  ok(/script-src-attr 'none'/.test(csp), 'inline event handlers are refused');
  ok(h.headers.get('x-powered-by') === null, 'the server does not announce what it runs on');
  ok(h.headers.get('x-content-type-options') === 'nosniff', 'browsers may not guess file types');
  ok(!!h.headers.get('strict-transport-security'), 'browsers are told to keep using https');

  // some data to list
  for (let i = 0; i < 14; i += 1) await call(base, 'POST', '/api/expenses', { category: i % 2 ? 'Seed' : 'Fuel', description: `Hardening test expense number ${i} with some words to make the list longer`, amount: 10 + i, expense_date: '2026-11-01' });
  const plain = await (await call(base, 'GET', '/api/expenses?perPage=50')).json();
  ok(plain.total === 14, 'test records exist', String(plain.total));

  const inj = await call(base, 'GET', '/api/expenses?perPage=50&category[$ne]=Seed');
  const injBody = await inj.json();
  ok(inj.status === 200 && injBody.total === 14, 'a filter written as an operator is not turned into a database operator (nothing is filtered by it)', `${inj.status} ${injBody.total}`);
  const where = await call(base, 'GET', '/api/expenses?perPage=50&$where=sleep(1)&sort=$where');
  ok(where.status === 200, 'operator-looking names are ignored');
  const sortBad = await (await call(base, 'GET', '/api/expenses?perPage=50&sort=amount;drop&order=asc')).json();
  ok(Array.isArray(sortBad.data) && sortBad.data.length === 14, 'a sort field with odd characters falls back to the default');
  const repeat = await call(base, 'GET', '/api/expenses?perPage=50&q=Hardening&q=number');
  ok(repeat.status === 200, 'a repeated query key does not cause an error', String(repeat.status));
  const arr = await call(base, 'GET', '/api/expenses?q[]=a&q[]=b');
  ok(arr.status === 200, 'q[]=... does not crash the search', String(arr.status));
  const last = await (await call(base, 'GET', '/api/expenses?perPage=50&category=Seed&category=Fuel')).json();
  ok(last.total === 7 && last.data.every((r) => r.category === 'Fuel'), 'when a key repeats, the last value wins', String(last.total));
  const long = await call(base, 'GET', `/api/expenses?q=${'x'.repeat(5000)}`);
  ok(long.status === 200, 'a very long search text is handled');

  const gz = await call(base, 'GET', '/api/expenses?perPage=50', undefined, { 'Accept-Encoding': 'gzip' });
  ok(gz.headers.get('content-encoding') === 'gzip', 'responses are compressed');
  ok((await gz.json()).total === 14, 'and the compressed answer is intact'); // fetch unpacks it for us

  const bad = await call(base, 'POST', '/api/expenses', '{"amount": ');
  const badBody = await bad.json();
  ok(bad.status === 400 && !('stack' in badBody), 'a broken request body is a 400 with no stack trace', `${bad.status}`);
  const big = await call(base, 'POST', '/api/expenses', JSON.stringify({ description: 'x'.repeat(3_000_000) }));
  ok(big.status === 413, 'an oversized request body is refused', String(big.status));

  // uploads
  const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#4a8f3a' } }).jpeg().toBuffer();
  const f = new FormData();
  f.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'leaf.jpg');
  const up = await fetch(`${base}/api/uploads`, { method: 'POST', headers: { 'x-dev-user': USER }, body: f });
  const url = (await up.json()).url;
  ok(/^\/uploads\/hardtest_farmer-\d+-[0-9a-f]{12}\.jpg$/.test(url || ''), 'an uploaded picture gets an unguessable name', url);
  const pic = await fetch(`${base}${url}`);
  ok(pic.status === 200 && /immutable/.test(pic.headers.get('cache-control') || ''), 'pictures can be kept by the browser');
  ok(/default-src 'none'/.test(pic.headers.get('content-security-policy') || ''), 'nothing in the uploads folder can run as a page');
  const trav = await fetch(`${base}/uploads/..%2f..%2fpackage.json`);
  ok(trav.status === 404 || trav.status === 400 || trav.status === 403, 'a path with ../ cannot leave the uploads folder', String(trav.status));
  const noAuth = await fetch(`${base}/api/expenses`);
  ok(noAuth.status === 401, 'the API refuses a request with no sign-in');
});

console.log('2. production mode serves the built web app');
const dist = new URL('../../../client/dist/index.html', import.meta.url);
if (!fs.existsSync(dist)) {
  console.log('  skip client/dist is not built (run npm run build)');
} else {
  await withServer(5083, { NODE_ENV: 'production', ALLOW_DEV_AUTH: '' }, async (base) => {
    const idx = await fetch(`${base}/`);
    ok(idx.status === 200 && /no-cache/.test(idx.headers.get('cache-control') || ''), 'the page itself is always re-checked');
    const html = await idx.text();
    ok(!/<script(?![^>]*\bsrc=)[^>]*>[^<]/i.test(html), 'the page has no inline script (so the policy can forbid them)');
    const asset = html.match(/\/assets\/[^"']+\.js/)?.[0];
    ok(!!asset, 'the page loads its script from /assets');
    if (asset) {
      const a = await fetch(`${base}${asset}`, { headers: { 'Accept-Encoding': 'gzip' } });
      ok(/immutable/.test(a.headers.get('cache-control') || ''), 'built files can be kept for a year');
      ok(a.headers.get('content-encoding') === 'gzip', 'built files are compressed');
    }
    const deep = await fetch(`${base}/farms`);
    ok(deep.status === 200 && (await deep.text()).includes('<div id="root">'), 'a deep link loads the app');
    const dev = await fetch(`${base}/api/expenses`, { headers: { 'x-dev-user': USER } });
    ok(dev.status === 401, 'the test sign-in header does nothing in production');
  });

  console.log('3. the test sign-in switch cannot be turned on in production');
  const exit = await new Promise((resolve) => {
    const c = spawn(process.execPath, ['src/index.js'], { cwd: new URL('../../', import.meta.url), env: { ...process.env, PORT: '5084', NODE_ENV: 'production', ALLOW_DEV_AUTH: '1' }, stdio: 'ignore' });
    const timer = setTimeout(() => { c.kill(); resolve('still running'); }, 15000);
    c.on('exit', (code) => { clearTimeout(timer); resolve(code); });
  });
  ok(exit === 1, 'the server refuses to start with ALLOW_DEV_AUTH=1 in production', String(exit));
}

await cleanup();
console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
