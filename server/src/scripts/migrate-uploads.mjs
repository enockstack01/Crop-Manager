/**
 * Copies the pictures on the server's disk into the configured bucket (run once, when switching STORAGE_DRIVER from local to s3):
 *
 *   STORAGE_DRIVER=s3 S3_BUCKET=... S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... [S3_ENDPOINT=...] node src/scripts/migrate-uploads.mjs [--dry-run]
 *
 * Files already in the bucket are skipped, so it is safe to run again. Nothing is deleted from the disk.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createStorage, UPLOAD_DIR } from '../lib/storage.js';

const dry = process.argv.includes('--dry-run');
const target = createStorage(process.env);
if (target.name !== 's3') { console.error('Set STORAGE_DRIVER=s3 (and the S3_* settings): there is nothing to copy to otherwise.'); process.exit(1); }
const have = new Set(await target.list(''));
const files = fs.readdirSync(UPLOAD_DIR).filter((f) => /\.jpe?g$|\.png$|\.webp$|\.gif$/i.test(f));
let copied = 0;
let skipped = 0;
for (const f of files) {
  if (have.has(f)) { skipped += 1; continue; }
  if (!dry) await target.put(f, fs.readFileSync(path.join(UPLOAD_DIR, f)));
  copied += 1;
}
console.log(`${dry ? 'would copy' : 'copied'} ${copied}, already there ${skipped}, on disk ${files.length}`);
