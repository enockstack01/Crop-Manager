/**
 * Checks the photo diagnosis flow end to end with the AI in mock mode and a stubbed classifier:
 *
 *   node src/scripts/test-diagnose-vision.mjs
 *
 * It starts the API itself (twice: classifier answering, classifier down), signs in with the dev-auth header,
 * uploads a photo, calls POST /api/ai/diagnose and checks the "detection" block and the usage log.
 * Everything it creates is removed. It never calls Hugging Face or the AI provider.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import sharp from 'sharp';
import { connectDB } from '../config/db.js';
import * as M from '../models/index.js';
import { AiUsage } from '../lib/ai/usage.js';

const PORT = 5076;
const BASE = `http://localhost:${PORT}/api`;
const PREFIX = 'vistest_';
const USER = `${PREFIX}farmer`;
let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };

await connectDB();
const cleanup = async () => {
  await Promise.all([
    M.Profile.deleteMany({ user_id: new RegExp(`^${PREFIX}`) }),
    AiUsage.deleteMany({ user_id: new RegExp(`^${PREFIX}`) }),
  ]);
  for (const f of fs.readdirSync(new URL('../../uploads/', import.meta.url))) if (f.startsWith(PREFIX)) fs.unlinkSync(new URL(`../../uploads/${f}`, import.meta.url));
};
await cleanup();
await M.Profile.create({ user_id: USER, email: 'farmer@vistest.local', email_verified: true, account_status: 'active', is_active: true, onboarded: true });

async function withServer(env, run) {
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: new URL('../../', import.meta.url),
    env: { ...process.env, PORT: String(PORT), ALLOW_DEV_AUTH: '1', AI_MOCK: '1', AI_API_KEY: 'mock', HF_TOKEN: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(`${BASE}/health`)).status < 500) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  try { await run(() => log); } finally { child.kill(); await new Promise((r) => setTimeout(r, 300)); }
}

const call = async (method, path, body, form) => {
  const res = await fetch(BASE + path, { method, headers: { 'x-dev-user': USER, ...(form ? {} : { 'Content-Type': 'application/json' }) }, body: form || (body ? JSON.stringify(body) : undefined) });
  let data = null;
  try { data = await res.json(); } catch { /* not json */ }
  return { status: res.status, data };
};
const upload = async () => {
  const jpeg = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#4a8f3a' } }).jpeg().toBuffer();
  const f = new FormData();
  f.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'leaf.jpg');
  const r = await call('POST', '/uploads', null, f);
  return r.data?.url;
};

console.log('1. classifier answers');
await withServer({ VISION_TEST_STUB: 'ok' }, async () => {
  const photo = await upload();
  ok(!!photo, 'a photo was uploaded');
  const r = await call('POST', '/ai/diagnose', { photo_url: photo, crop: 'Maize', language: 'rw' });
  ok(r.status === 200, 'diagnose answers 200', JSON.stringify(r.data).slice(0, 200));
  const d = r.data?.detection;
  ok(d?.source === 'classifier', 'detection.source is "classifier"');
  ok(d?.predictions?.length === 3 && d.predictions.every((p) => p.label && typeof p.confidence === 'number' && p.crop && p.disease && p.part), 'three predictions with label, confidence, crop, disease and part');
  ok(d?.confident === true && d?.unrecognised === false && d?.model_version === 'stub', 'carries confident, unrecognised and model_version');
  ok(!!r.data?.report && r.data?.photo_url === photo, 'the report and photo_url are still returned (existing clients keep working)');
  const row = await AiUsage.findOne({ user_id: USER, feature: 'diagnose' }).sort({ created_at: -1 }).lean();
  ok(row?.detector === 'classifier', 'AiUsage records detector = classifier');
  const text = await call('POST', '/ai/diagnose', { symptoms: 'yellow leaves', crop: 'Maize' });
  ok(text.status === 200 && text.data?.detection?.source === 'claude_only' && text.data.detection.predictions.length === 0, 'a text-only request has source "claude_only" and no predictions');
});

console.log('2. classifier down');
await withServer({ VISION_TEST_STUB: 'down' }, async () => {
  const photo = await upload();
  const r = await call('POST', '/ai/diagnose', { photo_url: photo, crop: 'Maize' });
  ok(r.status === 200 && !!r.data?.report, 'diagnose still answers 200 with a report');
  ok(r.data?.detection?.source === 'claude_only' && r.data.detection.predictions.length === 0, 'detection.source flips to "claude_only"');
  ok(r.data?.detection?.confident === false, 'confident is false');
  const row = await AiUsage.findOne({ user_id: USER, feature: 'diagnose', detector: 'fallback' }).lean();
  ok(!!row, 'AiUsage records detector = fallback');
});

console.log('3. classifier switched off');
await withServer({ VISION_TEST_STUB: 'ok', VISION_ENABLED: '0' }, async () => {
  const photo = await upload();
  const r = await call('POST', '/ai/diagnose', { photo_url: photo });
  ok(r.status === 200 && r.data?.detection?.source === 'claude_only', 'VISION_ENABLED=0 gives source "claude_only"');
  ok(!!(await AiUsage.findOne({ user_id: USER, feature: 'diagnose', detector: 'off' }).lean()), 'and is logged as detector = off, not as a failure');
});

console.log('4. usage report');
const { usageReport } = await import('../lib/ai/usage.js');
const rep = await usageReport(1);
ok(rep.diagnosis_detector.classifier >= 1 && rep.diagnosis_detector.fallback >= 1 && rep.diagnosis_detector.off >= 1, 'the admin usage report counts classifier, fallback and off', JSON.stringify(rep.diagnosis_detector));

await cleanup();
console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
