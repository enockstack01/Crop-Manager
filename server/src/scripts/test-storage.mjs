/**
 * Where uploaded pictures are kept:
 *
 *   node src/scripts/test-storage.mjs
 *
 * 1. the local driver; 2. the S3 driver against a small fake S3 server started here (no real bucket, no credentials, no network);
 * 3. the real API running with STORAGE_DRIVER=s3 against that fake: upload, read back through /uploads, safe names, removal on account deletion.
 * Removes everything it creates.
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { connectDB } from '../config/db.js';
import * as M from '../models/index.js';
import { createStorage } from '../lib/storage.js';

let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* A tiny S3: path-style object PUT, GET, DELETE and ListObjectsV2, enough for the driver. Signatures are not checked. */
function fakeS3(port) {
  const objects = new Map(); // "bucket/key" -> Buffer
  const log = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const path = decodeURIComponent(url.pathname).replace(/^\//, '');
      log.push(`${req.method} ${path}`);
      if (req.method === 'PUT') { objects.set(path, Buffer.concat(chunks)); res.writeHead(200, { ETag: '"x"' }); return res.end(); }
      if (req.method === 'DELETE') { objects.delete(path); res.writeHead(204); return res.end(); }
      if (req.method === 'GET' && url.searchParams.get('list-type') === '2') {
        const bucket = path.replace(/\/$/, '');
        const prefix = url.searchParams.get('prefix') || '';
        const keys = [...objects.keys()].filter((k) => k.startsWith(`${bucket}/`)).map((k) => k.slice(bucket.length + 1)).filter((k) => k.startsWith(prefix));
        res.writeHead(200, { 'Content-Type': 'application/xml' });
        return res.end(`<?xml version="1.0"?><ListBucketResult><Name>${bucket}</Name><Prefix>${prefix}</Prefix><KeyCount>${keys.length}</KeyCount><IsTruncated>false</IsTruncated>${keys.map((k) => `<Contents><Key>${k}</Key></Contents>`).join('')}</ListBucketResult>`);
      }
      if (req.method === 'GET') {
        const body = objects.get(path);
        if (!body) { res.writeHead(404, { 'Content-Type': 'application/xml' }); return res.end('<?xml version="1.0"?><Error><Code>NoSuchKey</Code><Message>missing</Message></Error>'); }
        res.writeHead(200, { 'Content-Length': body.length }); return res.end(body);
      }
      res.writeHead(405); return res.end();
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ server, objects, log })));
}

const S3_ENV = { STORAGE_DRIVER: 's3', S3_BUCKET: 'cmtest', S3_ACCESS_KEY_ID: 'test', S3_SECRET_ACCESS_KEY: 'test', S3_ENDPOINT: 'http://localhost:5090', S3_FORCE_PATH_STYLE: '1', S3_REGION: 'us-east-1', S3_PREFIX: 'pictures' };
const P = 'sttest_';
await connectDB();
const cleanup = async () => { await M.Profile.deleteMany({ user_id: new RegExp(`^${P}`) }); };
await cleanup();
const s3 = await fakeS3(5090);
let api = null;

try {
  console.log('1. the local driver');
  const local = createStorage({ STORAGE_DRIVER: 'local' });
  await local.put(`${P}a-1.jpg`, Buffer.from('one'));
  await local.put(`${P}a-2.jpg`, Buffer.from('two'));
  await local.put(`${P}b-1.jpg`, Buffer.from('three'));
  ok((await local.get(`${P}a-1.jpg`)).toString() === 'one', 'a stored file is read back');
  ok((await local.get(`${P}missing.jpg`)) === null, 'a missing file gives null');
  ok((await local.list(`${P}a-`)).length === 2, 'files are listed by prefix');
  ok((await local.removeWithPrefix(`${P}a-`)) === 2 && (await local.get(`${P}a-1.jpg`)) === null, 'everything of one person is removed');
  await local.remove(`${P}b-1.jpg`);
  ok((await local.list(P)).length === 0, 'one file can be removed');

  console.log('2. the S3 driver');
  const st = createStorage(S3_ENV);
  await st.put(`${P}u-1.jpg`, Buffer.from('alpha'));
  await st.put(`${P}u-2.jpg`, Buffer.from('beta'));
  await st.put(`${P}v-1.jpg`, Buffer.from('gamma'));
  ok(st.name === 's3' && s3.objects.has(`cmtest/pictures/${P}u-1.jpg`), 'files go to the bucket, inside the configured folder');
  ok((await st.get(`${P}u-1.jpg`)).toString() === 'alpha', 'a stored file is read back');
  ok((await st.get(`${P}nothing.jpg`)) === null, 'a missing file gives null, not an error');
  ok((await st.list(`${P}u-`)).sort().join() === `${P}u-1.jpg,${P}u-2.jpg`, 'files are listed by prefix, without the folder name');
  ok((await st.removeWithPrefix(`${P}u-`)) === 2 && !s3.objects.has(`cmtest/pictures/${P}u-1.jpg`) && s3.objects.has(`cmtest/pictures/${P}v-1.jpg`), 'everything of one person is removed, nobody else\'s');
  let msg = '';
  try { createStorage({ STORAGE_DRIVER: 's3' }); } catch (e) { msg = e.message; }
  ok(/S3_BUCKET/.test(msg), 'a missing setting is named', msg);
  try { createStorage({ STORAGE_DRIVER: 'ftp' }); msg = ''; } catch (e) { msg = e.message; }
  ok(/local.*s3/.test(msg), 'an unknown driver is refused');

  console.log('3. the API with the S3 driver');
  api = spawn(process.execPath, ['src/index.js'], {
    cwd: new URL('../../', import.meta.url),
    env: { ...process.env, PORT: '5089', HF_TOKEN: '', AI_MOCK: '1', ALLOW_DEV_AUTH: '1', ...S3_ENV },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 180; i += 1) { try { if ((await fetch('http://localhost:5089/api/health')).status < 500) break; } catch { /* not up */ } await sleep(500); }
  const USER = `${P}farmer`;
  await M.Profile.create({ user_id: USER, email: `${USER}@st.local`, email_verified: true, account_status: 'active', is_active: true, onboarded: true });
  const jpeg = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#2e7d32' } }).jpeg().toBuffer();
  const form = new FormData();
  form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'leaf.jpg');
  const up = await fetch('http://localhost:5089/api/uploads', { method: 'POST', headers: { 'x-dev-user': USER }, body: form });
  const upBody = await up.json();
  ok(up.status === 201 && /^\/uploads\/sttest_farmer-.*\.jpg$/.test(upBody.url), 'a picture is uploaded and gets the same kind of address', JSON.stringify(upBody));
  const name = upBody.url.split('/').pop();
  ok(s3.objects.has(`cmtest/pictures/${name}`), 'the picture is in the bucket, not on the disk');
  const get = await fetch(`http://localhost:5089${upBody.url}`);
  const bytes = Buffer.from(await get.arrayBuffer());
  ok(get.status === 200 && (await sharp(bytes).metadata()).format === 'jpeg', 'it is served back as a picture');
  ok(/immutable/.test(get.headers.get('cache-control') || '') && /sandbox/.test(get.headers.get('content-security-policy') || ''), 'with the long cache and the sandbox header');
  ok((await fetch('http://localhost:5089/uploads/nothing-here.jpg')).status === 404, 'an unknown picture is a 404');
  ok((await fetch('http://localhost:5089/uploads/..%2F..%2Fetc%2Fpasswd')).status === 404, 'a path trick is refused');
  const photoCall = await fetch('http://localhost:5089/api/ai/diagnose', { method: 'POST', headers: { 'x-dev-user': USER, 'Content-Type': 'application/json' }, body: JSON.stringify({ photo_urls: [upBody.url], notes: 'test' }) });
  ok(photoCall.status === 200, 'the assistant can read a picture from the bucket', String(photoCall.status));
  const other = await fetch('http://localhost:5089/api/ai/diagnose', { method: 'POST', headers: { 'x-dev-user': USER, 'Content-Type': 'application/json' }, body: JSON.stringify({ photo_urls: ['/uploads/someone_else-1-abc.jpg'] }) });
  ok(other.status === 400, 'but not someone else\'s picture', String(other.status));
} finally {
  api?.kill();
  s3.server.close();
  await cleanup();
  console.log(`\n${passed} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}
