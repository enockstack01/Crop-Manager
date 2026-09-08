import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import createHttpError from '../lib/httpError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${req.userId}-${Date.now()}${ext.toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(createHttpError(400, 'Only image uploads are allowed'));
  },
});

const router = Router();

// POST /api/uploads  (field name: "file")  -> { url }
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) throw createHttpError(400, 'No file uploaded');
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

export default router;
