/**
 * Sends real leaf photos through POST /api/ai/diagnose and saves everything an agronomist needs to review the answers.
 *
 *   node src/scripts/photo-review.mjs <photos-folder> <output-folder> [per-crop=25] [crops=Maize,Bean,Tomato,...]
 *
 * <photos-folder> holds one folder per class, named "Crop___Disease" (the layout of the training data), for example
 * "Maize___Gray leaf spot". For each crop it takes up to `per-crop` photos, spread over the crop's classes (a fixed
 * seed, so a rerun picks the same photos), uploads each, diagnoses it with the crop name set, and writes:
 *
 *   <output>/review.csv      one row per photo: the label of the folder, the classifier's top 3, the report title ...
 *   <output>/results.json    the same with the full reports
 *   <output>/latency.json    cold (first call) and warm timings of the whole request
 *   <output>/photos/         a copy of each photo, named as in review.csv, to open next to the report
 *
 * It starts the API itself on port 5078 with the settings in server/.env (real classifier when HF_TOKEN is set,
 * real AI), signs in with the dev-auth header, and removes its test user afterwards.
 * Note: photos taken from the training data were seen by the model, so accuracy on them is optimistic. For an honest
 * accuracy figure use photos the model never saw.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { connectDB } from '../config/db.js';
import * as M from '../models/index.js';
import { AiUsage } from '../lib/ai/usage.js';

const [SRC, OUT, PER = '25', CROPS = 'Maize,Bean,Tomato,Potato,Banana,Coffee,Tea,Cassava,Rice'] = process.argv.slice(2);
if (!SRC || !OUT) { console.log('usage: node src/scripts/photo-review.mjs <photos-folder> <output-folder> [per-crop] [crops]'); process.exit(2); }
const PER_CROP = Number(PER) || 25;
const crops = CROPS.split(',').map((c) => c.trim()).filter(Boolean);
fs.mkdirSync(path.join(OUT, 'photos'), { recursive: true });

const PORT = 5078;
const BASE = `http://localhost:${PORT}/api`;
const USER = 'photoreview_farmer';
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// a small seeded shuffle so reruns choose the same photos
let seed = 20261105;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** per-class folders of a crop, photos taken round-robin so every class is represented */
function pick(crop) {
  const dirs = fs.readdirSync(SRC).filter((d) => d.startsWith(`${crop}___`) && fs.statSync(path.join(SRC, d)).isDirectory());
  const lists = dirs.map((d) => shuffle(fs.readdirSync(path.join(SRC, d)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).map((f) => ({ cls: d, file: path.join(SRC, d, f) }))));
  const out = [];
  for (let i = 0; out.length < PER_CROP && lists.some((l) => l.length > i); i += 1) for (const l of shuffle([...lists])) if (l[i] && out.length < PER_CROP) out.push(l[i]);
  return out;
}

await connectDB();
const cleanup = async () => {
  await M.Profile.deleteMany({ user_id: USER });
  await AiUsage.deleteMany({ user_id: USER });
  for (const f of fs.readdirSync(new URL('../../uploads/', import.meta.url))) if (f.startsWith(`${USER}-`)) fs.unlinkSync(new URL(`../../uploads/${f}`, import.meta.url));
};
await cleanup();
await M.Profile.create({ user_id: USER, email: 'photoreview@test.local', email_verified: true, account_status: 'active', is_active: true, onboarded: true, language: 'en', ai_daily_limit: 100000, full_name: 'Photo Review' });

const child = spawn(process.execPath, ['src/index.js'], { cwd: new URL('../../', import.meta.url), env: { ...process.env, PORT: String(PORT), ALLOW_DEV_AUTH: '1', AI_MOCK: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
child.stdout.on('data', (d) => { serverLog += d; });
child.stderr.on('data', (d) => { serverLog += d; });
for (let i = 0; i < 60; i += 1) {
  try { if ((await fetch(`${BASE}/health`)).status < 500) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 500));
}

const results = [];
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
let n = 0;
for (const crop of crops) {
  const items = pick(crop);
  console.log(`${crop}: ${items.length} photos`);
  for (const it of items) {
    n += 1;
    const id = `${String(n).padStart(3, '0')}_${slug(crop)}_${slug(it.cls.split('___')[1] || '')}`;
    fs.copyFileSync(it.file, path.join(OUT, 'photos', `${id}${path.extname(it.file).toLowerCase()}`));
    const rec = { id, crop, folder_label: it.cls, file: path.basename(it.file) };
    const t0 = Date.now();
    try {
      const f = new FormData();
      f.append('file', new Blob([fs.readFileSync(it.file)], { type: 'image/jpeg' }), 'leaf.jpg');
      const up = await (await fetch(`${BASE}/uploads`, { method: 'POST', headers: { 'x-dev-user': USER }, body: f })).json();
      const res = await fetch(`${BASE}/ai/diagnose`, { method: 'POST', headers: { 'x-dev-user': USER, 'Content-Type': 'application/json' }, body: JSON.stringify({ photo_url: up.url, crop }), signal: AbortSignal.timeout(180_000) });
      rec.status = res.status;
      const data = await res.json().catch(() => null);
      rec.ms = Date.now() - t0;
      if (res.status === 200) { rec.detection = data.detection; rec.report = data.report; } else rec.error = data?.error || data?.message || 'failed';
    } catch (e) { rec.status = 0; rec.ms = Date.now() - t0; rec.error = String(e.message).slice(0, 120); }
    const u = await AiUsage.find({ user_id: USER }).sort({ created_at: -1 }).limit(1).lean();
    rec.detector = u[0]?.detector || '';
    await AiUsage.deleteMany({ user_id: USER }); // keeps the hourly request limit out of the way
    results.push(rec);
    const p1 = rec.detection?.predictions?.[0];
    console.log(`  ${id} ${rec.status} ${(rec.ms / 1000).toFixed(1)}s ${rec.detection?.source || '-'} ${p1 ? `${p1.crop}: ${p1.disease} ${Math.round(p1.confidence * 100)}%` : ''}`);
  }
}
child.kill();

const header = ['id', 'crop', 'folder_label (truth)', 'status', 'seconds', 'source', 'confident', 'unrecognised', 'top1 label', 'top1 %', 'top1 matches folder', 'top2 label', 'top2 %', 'top3 label', 'top3 %', 'report title', 'report confidence', 'severity', 'need_better_photo', 'treatment (first 200 chars)', 'agronomist verdict (fill in)', 'agronomist notes (fill in)'];
const rows = results.map((r) => {
  const p = r.detection?.predictions || [];
  const truth = slug(r.folder_label);
  return [r.id, r.crop, r.folder_label, r.status, (r.ms / 1000).toFixed(1), r.detection?.source || '', r.detection?.confident ?? '', r.detection?.unrecognised ?? '', p[0]?.label || '', p[0] ? Math.round(p[0].confidence * 100) : '', p[0] ? (p[0].label === truth ? 'yes' : 'no') : '', p[1]?.label || '', p[1] ? Math.round(p[1].confidence * 100) : '', p[2]?.label || '', p[2] ? Math.round(p[2].confidence * 100) : '', r.report?.title || '', r.report?.confidence || '', r.report?.severity || '', r.report?.need_better_photo ?? '', (r.report?.treatment || '').slice(0, 200), '', ''];
});
fs.writeFileSync(path.join(OUT, 'review.csv'), `${[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')}\n`);
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));

const secs = (list) => list.map((r) => r.ms / 1000).sort((a, b) => a - b);
const pct = (a, q) => (a.length ? a[Math.min(a.length - 1, Math.floor(q * a.length))] : null);
const ok = results.filter((r) => r.status === 200);
const viaSpace = ok.filter((r) => r.detection?.source === 'classifier');
const warm = secs(ok.slice(1));
const latency = {
  photos: results.length, answered: ok.length, via_classifier: viaSpace.length, fallback_claude_only: ok.length - viaSpace.length,
  first_call_seconds: ok[0] ? ok[0].ms / 1000 : null,
  warm_seconds: { p50: pct(warm, 0.5), p90: pct(warm, 0.9), max: warm.at(-1) ?? null },
  top1_matches_folder: viaSpace.length ? `${viaSpace.filter((r) => r.detection.predictions[0].label === slug(r.folder_label)).length}/${viaSpace.length}` : 'n/a (the classifier did not answer)',
  server_notes: serverLog.split('\n').filter((l) => /\[vision\]/.test(l)).slice(0, 5),
};
fs.writeFileSync(path.join(OUT, 'latency.json'), JSON.stringify(latency, null, 2));
console.log('\n', JSON.stringify(latency, null, 2));
await cleanup();
process.exit(0);
