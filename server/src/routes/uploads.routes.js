import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import createHttpError from '../lib/httpError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { IMAGE_EXTENSIONS, toJpeg } from '../lib/images.js';
import { storage, UPLOAD_DIR } from '../lib/storage.js';

export { UPLOAD_DIR }; // the folder used by the local driver

// held in memory, converted to JPEG, then written: a phone photo can be 10 MB or more, the stored picture is a few hundred KB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    // browsers and phones name HEIC and TIFF files with odd types (or none), so the extension counts too; the bytes decide in the end
    const looksLikeImage = /^image\//.test(file.mimetype) || IMAGE_EXTENSIONS.includes(ext) || (file.mimetype === 'application/octet-stream' && !ext);
    if (looksLikeImage) cb(null, true);
    else cb(createHttpError(400, 'Only pictures can be uploaded (JPG, PNG, HEIC, WebP, AVIF, GIF, TIFF, BMP).'));
  },
});

/** Deletes every picture a person uploaded (used when their account is deleted). Returns how many files went. */
export async function removeUploadsOf(userId) {
  return storage.removeWithPrefix(`${userId}-`);
}

const router = Router();

// POST /api/uploads  (field name: "file")  -> { url }   any picture format; stored as an upright JPEG
router.post('/', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw createHttpError(400, 'No file uploaded');
  let jpeg;
  try {
    jpeg = await toJpeg(req.file.buffer);
  } catch {
    throw createHttpError(400, 'That picture could not be read. Try another one, or take a new photo.', { code: 'unreadable_image' });
  }
  const name = `${req.userId}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.jpg`; // the random part keeps other people from guessing a picture's address
  await storage.put(name, jpeg);
  res.status(201).json({ url: `/uploads/${name}`, bytes: jpeg.length });
}));

export default router;
