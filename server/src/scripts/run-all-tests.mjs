/**
 * Runs every server test suite in one command and prints a table:
 *
 *   npm run test:all --workspace server
 *
 * It starts the API itself on port 5075 in test mode (dev-auth header, mock AI, no Clerk call, no Hugging Face) for the suites that need
 * one running; the others start their own. Needs MONGODB_URI and the Clerk keys in server/.env (any values for the Clerk keys in CI),
 * and client/dist (npm run build) for the production-mode checks of test:hardening. Exit code 1 when any suite fails.
 */
import { spawn } from 'node:child_process';

const SUITES = [
  ['security', 85], ['orgs', 68], ['invites', 18], ['workspace', 31], ['tenancy', 14], ['images', null],
  ['storage', 20], ['ratelimit', 10], ['vision', 34], ['diagnose-vision', 15], ['hardening', 35],
];
const cwd = new URL('../../', import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const api = spawn(process.execPath, ['src/index.js'], {
  cwd,
  env: { ...process.env, PORT: '5075', ALLOW_DEV_AUTH: '1', AI_MOCK: '1', HF_TOKEN: '', INVITE_DRY_RUN: '1' },
  stdio: ['ignore', 'ignore', 'inherit'],
});
let up = false;
for (let i = 0; i < 240 && !up; i += 1) {
  try { up = (await fetch('http://localhost:5075/api/health')).status < 500; } catch { await sleep(500); }
}
if (!up) { console.error('The test server did not start.'); api.kill(); process.exit(1); }

const run = (name) => new Promise((resolve) => {
  const t0 = Date.now();
  let out = '';
  const child = spawn(process.execPath, [`src/scripts/test-${name}.mjs`], { cwd, env: { ...process.env, TEST_BASE: 'http://localhost:5075/api' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('close', (code) => {
    const m = out.match(/(\d+) passed, (\d+) failed/);
    resolve({ name, code, passed: m ? Number(m[1]) : out.includes('ALL OK') ? 1 : 0, failed: m ? Number(m[2]) : code ? 1 : 0, seconds: Math.round((Date.now() - t0) / 1000), out });
  });
});

const results = [];
for (const [name, expected] of SUITES) {
  const r = await run(name);
  r.expected = expected;
  results.push(r);
  console.log(`${r.code === 0 ? 'ok  ' : 'FAIL'} ${name.padEnd(10)} ${String(r.passed).padStart(3)} passed, ${r.failed} failed  (${r.seconds}s)${expected && r.passed !== expected && r.code === 0 ? `  [expected ${expected}]` : ''}`);
  if (r.code !== 0) console.log(r.out.split('\n').filter((l) => !l.startsWith('  ok')).slice(-25).join('\n'));
}
api.kill();
const bad = results.filter((r) => r.code !== 0);
console.log(`\n${results.length - bad.length} of ${results.length} suites passed, ${results.reduce((s, r) => s + r.passed, 0)} checks in total`);
process.exit(bad.length ? 1 : 0);
