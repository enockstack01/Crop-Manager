/**
 * Checks sign-in (authentication) and permissions (authorization) end to end against the REAL Clerk instance in server/.env:
 *
 *   node src/scripts/check-clerk-auth.mjs
 *
 * It creates one throwaway user in your Clerk instance, opens a session for it, starts the API on port 5091 WITHOUT the test sign-in
 * switch, and calls it with that session's real token. Each step prints PASS or FAIL with what to change in Clerk or in the server
 * settings. The throwaway user and its profile are deleted at the end. Use a development instance (pk_test_ / sk_test_), not production.
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { clerkClient } from '@clerk/express';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { Profile } from '../models/index.js';

const decodeInstance = (pk) => { try { return Buffer.from(String(pk).split('_').slice(2).join('_'), 'base64').toString().replace(/\$$/, ''); } catch { return ''; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const pass = (label) => console.log(`PASS  ${label}`);
const fail = (label, fix) => { fails += 1; console.log(`FAIL  ${label}\n      -> ${fix}`); };
const check = (ok, label, fix) => (ok ? pass(label) : fail(label, fix));

const pk = env.clerkPublishableKey;
const sk = env.clerkSecretKey;
const instance = decodeInstance(pk);
console.log(`Server settings: instance ${instance || '(unreadable key)'}, ${pk.slice(0, 8)}… / ${sk.slice(0, 8)}…\n`);

console.log('1. The keys');
check(pk.startsWith('pk_test_') === sk.startsWith('sk_test_'), 'publishable and secret key are both test or both live', 'CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY must come from the SAME Clerk instance (Clerk dashboard > API keys).');
if (env.isProd && pk.startsWith('pk_test_')) fail('production is using a development Clerk instance', 'Create the Production instance in Clerk and use its pk_live_ / sk_live_ keys on Render, in the web build (VITE_CLERK_PUBLISHABLE_KEY) and in the mobile app (EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY).');
else pass('the instance type fits where this runs');

// keys the web and mobile apps would be built with, if their settings are on this machine
for (const [file, name] of [['../../client/.env', 'VITE_CLERK_PUBLISHABLE_KEY'], ['../../mobile/.env', 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY'], ['../../mobile/.env.local', 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY']]) {
  try {
    const text = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    const m = text.match(new RegExp(`^${name}=(\\S+)`, 'm'));
    if (m) check(decodeInstance(m[1]) === instance, `${file.replace('../../', '')} uses the same Clerk instance as the server`, `${name} points at ${decodeInstance(m[1])} but the server uses ${instance}. Tokens from one instance are rejected by the other (every request is 401). Use one instance everywhere.`);
  } catch { /* file not on this machine */ }
}

console.log('\n2. The secret key works');
let user = null;
let sessionId = null;
const email = `authprobe+${Date.now()}@example.com`;
const cleanup = async () => {
  try { if (user) await clerkClient.users.deleteUser(user.id); } catch { /* already gone */ }
  try { await connectDB(); if (user) await Profile.deleteMany({ user_id: user.id }); } catch { /* none */ }
};
try {
  await clerkClient.users.getUserList({ limit: 1 });
  pass('Clerk accepts CLERK_SECRET_KEY');
} catch (e) {
  fail('Clerk refuses CLERK_SECRET_KEY', `${e?.errors?.[0]?.message || e.message}. Copy the secret key again from Clerk dashboard > API keys into CLERK_SECRET_KEY.`);
  process.exit(1);
}

let token = '';
try {
  user = await clerkClient.users.createUser({ emailAddress: [email], password: crypto.randomBytes(18).toString('base64url') + 'aA1!', firstName: 'Auth', lastName: 'Probe', skipPasswordChecks: true });
  const session = await clerkClient.sessions.createSession({ userId: user.id });
  sessionId = session.id;
  const t = await clerkClient.sessions.getToken(sessionId, '');
  token = t?.jwt || '';
  check(!!token, 'a test user and a real session token were created', 'Clerk did not return a session token for the test session.');
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  check(String(claims.iss || '').includes(instance), `the token is issued by ${claims.iss}`, `The token's issuer is not the instance in the publishable key (${instance}).`);
} catch (e) {
  fail('could not create a test user or session', `${e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || e.message}. In Clerk dashboard > Configure > Email, phone, username make sure "Email address" is enabled, then run again.`);
  await cleanup();
  process.exit(1);
}

const start = async (port, extra) => {
  const child = spawn(process.execPath, ['src/index.js'], { cwd: new URL('../../', import.meta.url), env: { ...process.env, PORT: String(port), ALLOW_DEV_AUTH: '', AI_MOCK: '1', HF_TOKEN: '', RATE_LIMIT_STORE: 'memory', ...extra }, stdio: ['ignore', 'ignore', 'ignore'] });
  for (let i = 0; i < 180; i += 1) { try { if ((await fetch(`http://localhost:${port}/api/health`)).status < 500) return child; } catch { /* not yet */ } await sleep(500); }
  return child;
};
const call = (port, path, bearer) => fetch(`http://localhost:${port}/api${path}`, { headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let api = null;
try {
  console.log('\n3. Authentication: the API accepts only real Clerk sessions');
  api = await start(5091, { ADMIN_EMAILS: '' });
  check((await call(5091, '/profile')).status === 401, 'no token is refused (401)', 'A request without a token must be 401.');
  check((await call(5091, '/profile', 'not.a.token')).status === 401, 'a made-up token is refused (401)', 'The server accepted an invalid token: check that clerkMiddleware is installed before the routes.');
  check((await call(5091, '/crops', token)).status !== 401, 'a real Clerk session token is accepted', `The server answered 401 to a valid token from ${instance}. The server's CLERK_SECRET_KEY belongs to a different Clerk instance than the app that signed in.`);
  const me = await call(5091, '/profile', token);
  check(me.status === 200, 'the profile loads for a signed-in user', `GET /api/profile returned ${me.status}: ${me.body?.message || ''}`);
  check(me.body?.email === email, 'the email address is read from Clerk', 'The server could not read the user from Clerk (CLERK_SECRET_KEY problem): the email is empty, so invitations and admin rights cannot work.');
  check(me.body?.email_verified === true, 'the email address counts as verified', 'The address is not verified in Clerk. Admin rights and invitations only apply to VERIFIED addresses: require email verification in Clerk (Configure > Email) or verify the address.');

  console.log('\n4. Authorization: who may do what');
  check(me.body?.account_status === 'new' && me.body?.is_admin !== true, 'a new user is not an administrator and has not been approved', 'A brand-new account must start as status "new".');
  const blocked = await call(5091, '/crops', token);
  check(blocked.status === 403, 'farm data is closed until the account is approved (403)', `Expected 403 for an unapproved account, got ${blocked.status}.`);
  check((await call(5091, '/admin/overview', token)).status === 403, 'the admin area is closed to ordinary users (403)', 'An ordinary user reached an admin route.');
  api.kill(); await sleep(500);

  api = await start(5091, { ADMIN_EMAILS: email });
  await call(5091, '/profile', token); // signing in is what grants the allowlisted address its rights
  const admin = await call(5091, '/profile', token);
  check(admin.body?.is_admin === true, 'an address in ADMIN_EMAILS becomes an administrator at its first profile load', 'ADMIN_EMAILS (server setting, comma separated, lower case) must contain the exact address, and the address must be verified in Clerk.');
  check((await call(5091, '/admin/overview', token)).status === 200, 'the administrator can open the admin area', 'The allowlisted administrator was refused on /api/admin/overview.');
} finally {
  api?.kill();
  await cleanup();
  console.log(`\n${fails ? `${fails} problem(s) found. Fix the lines marked FAIL, then run this again.` : 'Everything checks out: sign-in and permissions work against your Clerk instance.'}`);
  console.log('(The test user was deleted from Clerk and from the database.)');
  process.exit(fails ? 1 : 0);
}
