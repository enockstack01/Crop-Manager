import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * Where uploaded pictures live. One small interface, two places:
 *
 *   STORAGE_DRIVER=local   the server's own disk (server/uploads). Simple, but the disk is lost when the host redeploys
 *                          unless a persistent disk is attached. The default.
 *   STORAGE_DRIVER=s3      any S3-compatible bucket: Amazon S3, Cloudflare R2, Backblaze B2, MinIO ... Pictures survive redeploys
 *                          and the server can run on several machines.
 *
 *   S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY      required for s3
 *   S3_REGION (default auto), S3_ENDPOINT (R2, B2, MinIO), S3_FORCE_PATH_STYLE=1 (MinIO), S3_PREFIX (a folder inside the bucket)
 *
 * Pictures are always read and sent through the API (/uploads/<name>), so the web addresses, the unguessable file names, the 30-day cache
 * and the "sandbox" security header are the same with either driver, and the bucket can stay completely private.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

/** A stored file's name: letters, digits, dot, dash, underscore. Anything else (slashes, dots only, ...) is never a picture of ours. */
export const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;

/* ------------------------------------------------------------------- local */
function localDriver() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const file = (name) => path.join(UPLOAD_DIR, name);
  return {
    name: 'local',
    async put(name, bytes) { await fs.promises.writeFile(file(name), bytes); },
    async get(name) { try { return await fs.promises.readFile(file(name)); } catch { return null; } },
    async remove(name) { await fs.promises.unlink(file(name)).catch(() => {}); },
    async removeWithPrefix(prefix) {
      let removed = 0;
      for (const f of await fs.promises.readdir(UPLOAD_DIR)) {
        if (!f.startsWith(prefix)) continue;
        await fs.promises.unlink(file(f)).then(() => { removed += 1; }, () => {});
      }
      return removed;
    },
    async list(prefix = '') { return (await fs.promises.readdir(UPLOAD_DIR)).filter((f) => f.startsWith(prefix)); },
  };
}

/* ---------------------------------------------------------------------- s3 */
function s3Driver(cfg) {
  let clientPromise = null;
  // the SDK is large: it is only loaded when this driver is used
  const sdk = () => import('@aws-sdk/client-s3');
  const client = () => (clientPromise ||= sdk().then(({ S3Client }) => new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint || undefined,
    forcePathStyle: cfg.forcePathStyle,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED', // R2, B2 and MinIO do not all accept the newer automatic checksums
    responseChecksumValidation: 'WHEN_REQUIRED',
  })));
  const key = (name) => `${cfg.prefix}${name}`;
  const send = async (make) => { const lib = await sdk(); return (await client()).send(make(lib)); };
  return {
    name: 's3',
    async put(name, bytes) {
      await send((l) => new l.PutObjectCommand({ Bucket: cfg.bucket, Key: key(name), Body: bytes, ContentType: 'image/jpeg', CacheControl: 'public, max-age=2592000, immutable' }));
    },
    async get(name) {
      try {
        const out = await send((l) => new l.GetObjectCommand({ Bucket: cfg.bucket, Key: key(name) }));
        return Buffer.from(await out.Body.transformToByteArray());
      } catch (err) {
        if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return null;
        throw err;
      }
    },
    async remove(name) { await send((l) => new l.DeleteObjectCommand({ Bucket: cfg.bucket, Key: key(name) })); },
    async list(prefix = '') {
      const names = [];
      let token;
      do {
        const out = await send((l) => new l.ListObjectsV2Command({ Bucket: cfg.bucket, Prefix: key(prefix), ContinuationToken: token }));
        for (const o of out.Contents || []) names.push(o.Key.slice(cfg.prefix.length));
        token = out.IsTruncated ? out.NextContinuationToken : undefined;
      } while (token);
      return names;
    },
    async removeWithPrefix(prefix) {
      const names = await this.list(prefix);
      for (const n of names) await this.remove(n);
      return names.length;
    },
  };
}

export function createStorage(env = process.env) {
  const driver = (env.STORAGE_DRIVER || 'local').toLowerCase();
  if (driver === 'local') return localDriver();
  if (driver !== 's3') throw new Error(`STORAGE_DRIVER must be "local" or "s3" (got "${driver}")`);
  const missing = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'].filter((k) => !env[k]);
  if (missing.length) throw new Error(`STORAGE_DRIVER=s3 needs ${missing.join(', ')}`);
  const prefix = (env.S3_PREFIX || '').replace(/^\/+|\/+$/g, '');
  return s3Driver({
    bucket: env.S3_BUCKET, region: env.S3_REGION || 'auto', endpoint: env.S3_ENDPOINT || '',
    forcePathStyle: env.S3_FORCE_PATH_STYLE === '1', accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    prefix: prefix ? `${prefix}/` : '',
  });
}

export const storage = createStorage();
