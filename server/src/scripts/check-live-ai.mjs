/**
 * Tests the AI on a RUNNING server (for example production) as a signed-in farmer would use it:
 *
 *   node src/scripts/check-live-ai.mjs https://crop.agricoders.com
 *
 * Uses the DEVELOPMENT Clerk instance in server/.env, so it only works when that server uses the same Clerk instance. It creates one throwaway
 * user, signs in with a real session token, opens its account in the shared database, asks the server for the AI status and sends one tiny
 * chat message ("Say OK"), then deletes the user, its profile and its usage rows. Prints the server's exact answers.
 */
import crypto from 'node:crypto';
import { clerkClient } from '@clerk/express';
import { connectDB } from '../config/db.js';
import { Profile } from '../models/index.js';
import { AiUsage } from '../lib/ai/usage.js';

const base = (process.argv[2] || '').replace(/\/$/, '');
if (!base) { console.error('Usage: node src/scripts/check-live-ai.mjs https://your-server'); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const call = async (method, path, token, body) => {
  const r = await fetch(`${base}/api${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(120_000) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

await connectDB();
const email = `authprobe+ai${Date.now()}@example.com`;
let user = null;
try {
  user = await clerkClient.users.createUser({ emailAddress: [email], password: `${crypto.randomBytes(18).toString('base64url')}aA1!`, firstName: 'AI', lastName: 'Probe', skipPasswordChecks: true });
  const session = await clerkClient.sessions.createSession({ userId: user.id });
  const token = (await clerkClient.sessions.getToken(session.id, '')).jwt;

  console.log(`Server: ${base}`);
  let me = await call('GET', '/profile', token);
  console.log(`1. sign in with a real token: profile ${me.status}${me.status === 401 ? ' -> THE LIVE SERVER REJECTS THIS CLERK INSTANCE (its CLERK_SECRET_KEY is for another instance)' : ''}`);
  if (me.status !== 200) process.exit(1);

  await Profile.updateOne({ user_id: user.id }, { $set: { account_status: 'active', is_active: true } });
  await sleep(500);
  me = await call('GET', '/profile', token);
  console.log(`2. account opened in the shared database: status "${me.body.account_status}"${me.body.account_status === 'active' ? '' : ' -> the live server uses a DIFFERENT database than server/.env; stopping'}`);
  if (me.body.account_status !== 'active') process.exit(1);

  const status = await call('GET', '/ai/status', token);
  console.log(`3. AI status: HTTP ${status.status} ${JSON.stringify(status.body).slice(0, 300)}`);
  const chat = await call('POST', '/ai/chat', token, { messages: [{ role: 'user', content: 'Say OK.' }] });
  console.log(`4. chat: HTTP ${chat.status} ${JSON.stringify(chat.body).slice(0, 300)}`);
  const diag = await call('POST', '/ai/advice', token, { topic: 'weeding' });
  console.log(`5. advice (a second feature): HTTP ${diag.status} ${JSON.stringify(diag.body).slice(0, 160)}`);
} finally {
  try { if (user) await clerkClient.users.deleteUser(user.id); } catch { /* gone */ }
  if (user) { await Profile.deleteMany({ user_id: user.id }); await AiUsage.deleteMany({ user_id: user.id }); }
  console.log('(test user, profile and usage rows deleted)');
  process.exit(0);
}
