/*
 * Checks that every picture format becomes a readable JPEG:  node src/scripts/test-images.mjs [path-to-a-heic-file]
 * (HEIC needs a real sample file; the other formats are generated here.)
 */
import fs from 'node:fs';
import sharp from 'sharp';
import bmp from 'bmp-js';
import { sniff, toJpeg } from '../lib/images.js';

let failed = 0;
const ok = (c, m, x = '') => { console.log(c ? '  ok  ' : '  FAIL', m, x); if (!c) failed += 1; };

const base = await sharp({ create: { width: 1200, height: 800, channels: 4, background: { r: 46, g: 125, b: 50, alpha: 0.6 } } })
  .composite([{ input: Buffer.from('<svg width="400" height="300"><rect width="400" height="300" fill="#F9A825"/></svg>'), top: 100, left: 100 }])
  .png().toBuffer();

const samples = {
  png: base,
  webp: await sharp(base).webp().toBuffer(),
  gif: await sharp(base).gif().toBuffer(),
  avif: await sharp(base).avif({ quality: 40 }).toBuffer(),
  tiff: await sharp(base).tiff().toBuffer(),
  jpeg: await sharp(base).flatten({ background: '#fff' }).jpeg().toBuffer(),
  'jpeg (phone, rotated by EXIF)': await sharp(base).flatten({ background: '#fff' }).jpeg().withMetadata({ orientation: 6 }).toBuffer(),
  svg: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#2E7D32"/></svg>'),
};
const raw = await sharp(base).flatten({ background: '#fff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const abgr = Buffer.alloc(raw.data.length);
for (let i = 0; i < raw.data.length; i += 4) { abgr[i] = 255; abgr[i + 1] = raw.data[i + 2]; abgr[i + 2] = raw.data[i + 1]; abgr[i + 3] = raw.data[i]; }
samples.bmp = bmp.encode({ data: abgr, width: raw.info.width, height: raw.info.height }).data;
if (process.argv[2] && fs.existsSync(process.argv[2])) samples['heic (iPhone)'] = fs.readFileSync(process.argv[2]);

for (const [name, buf] of Object.entries(samples)) {
  try {
    const out = await toJpeg(buf);
    const m = await sharp(out).metadata();
    ok(m.format === 'jpeg' && sniff(out) === 'jpeg' && m.width <= 2000 && m.height <= 2000, `${name}: ${Math.round(buf.length / 1024)} KB -> JPEG ${m.width}x${m.height}, ${Math.round(out.length / 1024)} KB`);
    if (name.startsWith('jpeg (phone')) ok(m.height >= m.width || (m.width === 800 && m.height === 1200), 'the EXIF rotation was applied', `${m.width}x${m.height}`);
  } catch (e) {
    ok(false, `${name} could not be converted`, e.message);
  }
}
for (const [name, buf] of Object.entries({ 'a text file': Buffer.from('this is not a picture at all, just words.'), 'empty': Buffer.alloc(0), 'a PDF': Buffer.from('%PDF-1.4 fake pdf content here') })) {
  let rejected = false;
  try { await toJpeg(buf); } catch { rejected = true; }
  ok(rejected, `${name} is rejected`);
}
console.log(failed ? `${failed} FAILED` : 'ALL OK');
process.exit(failed ? 1 : 0);
