/**
 * Runs every AI feature once against the REAL model (no mock) on a throwaway test farm, to check that the
 * tier now chosen for each task (Fast by default) answers well and nothing is cut off.
 *
 *   node src/scripts/check-ai-features.mjs <output-folder> [photo.jpg]
 *
 * It needs AI_API_KEY in server/.env (the key is never printed). It starts the API itself on port 5077, creates a
 * test user with the demo farm, calls the endpoints, writes each reply to <output-folder>, prints a summary and removes
 * the test data. Each run uses a few dozen model requests.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { connectDB } from '../config/db.js';
import * as M from '../models/index.js';
import { seedUser } from '../lib/seedData.js';
import { AiUsage } from '../lib/ai/usage.js';

const OUT = process.argv[2];
const PHOTO = process.argv[3];
if (!OUT) { console.log('usage: node src/scripts/check-ai-features.mjs <output-folder> [photo.jpg]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const PORT = 5077;
const BASE = `http://localhost:${PORT}/api`;
const USER = 'aicheck_farmer';

await connectDB();
const cleanup = async () => {
  await M.Profile.deleteMany({ user_id: USER });
  await AiUsage.deleteMany({ user_id: USER });
  const { clearUser } = await import('../lib/seedData.js');
  await clearUser(USER);
  for (const f of fs.readdirSync(new URL('../../uploads/', import.meta.url))) if (f.startsWith(`${USER}-`)) fs.unlinkSync(new URL(`../../uploads/${f}`, import.meta.url));
};
await cleanup();
await M.Profile.create({ user_id: USER, email: 'aicheck@test.local', email_verified: true, account_status: 'active', is_active: true, onboarded: true, language: 'en', ai_daily_limit: 500, full_name: 'AI Check' });
await seedUser(USER);

const child = spawn(process.execPath, ['src/index.js'], {
  cwd: new URL('../../', import.meta.url),
  env: { ...process.env, PORT: String(PORT), ALLOW_DEV_AUTH: '1', AI_MOCK: '0', VISION_ENABLED: '0', AI_HOURLY_LIMIT: '500' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
child.stdout.on('data', (d) => { log += d; });
child.stderr.on('data', (d) => { log += d; });
for (let i = 0; i < 60; i += 1) {
  try { if ((await fetch(`${BASE}/health`)).status < 500) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 500));
}

const rows = [];
async function run(name, method, p, body, check) {
  const t0 = Date.now();
  let status = 0; let data = null;
  try {
    const res = await fetch(BASE + p, { method, headers: { 'x-dev-user': USER, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(120_000) });
    status = res.status;
    data = await res.json().catch(() => null);
  } catch (e) { data = { error: String(e.message) }; }
  // read this call's usage rows, then clear them so the hourly request limit never blocks the next call
  const use = await AiUsage.find({ user_id: USER }).lean();
  await AiUsage.deleteMany({ user_id: USER });
  const text = JSON.stringify(data);
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data, null, 2));
  const verdict = status === 200 ? (check ? check(data) : '') : `HTTP ${status}: ${String(data?.error || data?.message || '').slice(0, 120)}`;
  rows.push({ name, status, secs: ((Date.now() - t0) / 1000).toFixed(1), chars: text.length, models: [...new Set(use.map((u) => u.model))].join('/') || '-', out: use.reduce((n, u) => n + (u.output_tokens || 0), 0), verdict });
  console.log(`${status === 200 && !verdict ? 'ok  ' : status === 200 ? 'note' : 'FAIL'} ${name.padEnd(26)} ${String(status).padEnd(4)} ${rows.at(-1).secs.padStart(5)}s  model=${rows.at(-1).models.padEnd(6)} out_tokens=${String(rows.at(-1).out).padEnd(5)} ${verdict}`);
}

const lastWords = (s) => String(s || '').trim().slice(-1);
const endsClean = (s) => /[.!?)\]"'»:]$/.test(String(s || '').trim()) || /\d$/.test(String(s || '').trim());

await run('chat-tools-spend', 'POST', '/ai/chat', { messages: [{ role: 'user', content: 'How much have I spent in total on fertilizer and on seed, and which farm spent more? Give the numbers.' }] }, (d) => (!/\d/.test(d.reply) ? 'no numbers in the answer' : !endsClean(d.reply) ? 'answer may be cut off' : ''));
await run('chat-tools-stock', 'POST', '/ai/chat', { messages: [{ role: 'user', content: 'Is any of my stock low or about to expire? List each item with its quantity.' }] }, (d) => (!endsClean(d.reply) ? 'answer may be cut off' : ''));
await run('chat-weather-tool', 'POST', '/ai/chat', { messages: [{ role: 'user', content: 'Should I spray this week? Check the weather first.' }] }, (d) => (!endsClean(d.reply) ? 'answer may be cut off' : ''));
await run('season-summary', 'POST', '/ai/season-summary', { scope: 'the whole farm for this season' });
await run('calculator-report', 'POST', '/ai/calculator-report', { type: 'fertilizer', inputs: { area_ha: 12, crop: 'Maize', n_target_kg_ha: 120 }, results: [{ label: 'Urea needed', value: '3130 kg' }, { label: 'Cost', value: 'ZMW 52 000' }] });
await run('insights', 'POST', '/ai/insights', {});
for (const topic of ['inputs', 'planting', 'fertiliser', 'irrigation', 'protection', 'harvest']) await run(`advice-${topic}`, 'POST', '/ai/advice', { topic, question: 'What should I do next?' });
await run('parse-record', 'POST', '/ai/parse-record', { text: 'bought 20 bags of urea for 4500 kwacha from Agro Supplies yesterday for Green Valley' }, (d) => (d.resource !== 'expenses' || !d.record?.amount ? 'did not read the expense' : ''));
await run('weather-briefing', 'POST', '/ai/weather-briefing', {}, (d) => (!endsClean(d.briefing) ? 'briefing may be cut off' : ''));
await run('diagnose-text', 'POST', '/ai/diagnose', { crop: 'Maize', symptoms: 'long grey rectangular spots on lower leaves after rain', affected: '30 in 100 plants' }, (d) => (!d.report?.title || !d.report?.treatment ? 'report is missing parts' : ''));
if (PHOTO && fs.existsSync(PHOTO)) {
  const f = new FormData();
  f.append('file', new Blob([fs.readFileSync(PHOTO)], { type: 'image/jpeg' }), 'leaf.jpg');
  const up = await (await fetch(`${BASE}/uploads`, { method: 'POST', headers: { 'x-dev-user': USER }, body: f })).json();
  await run('diagnose-photo', 'POST', '/ai/diagnose', { photo_url: up.url, crop: 'Maize' }, (d) => (!d.report?.title ? 'no title' : ''));
}

child.kill();
const cut = log.split('\n').filter((l) => /cut off|token limit/i.test(l));
console.log(cut.length ? `\nTruncation warnings from the server:\n${cut.join('\n')}` : '\nNo truncation warnings from the server.');
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ rows, truncation: cut }, null, 2));
await cleanup();
const bad = rows.filter((r) => r.status !== 200).length;
console.log(`${rows.length - bad}/${rows.length} answered. Outputs are in ${OUT}`);
process.exit(bad ? 1 : 0);
