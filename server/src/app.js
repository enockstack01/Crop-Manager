import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { clerkMiddleware } from '@clerk/express';

import { env } from './config/env.js';
import api from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.js';
import { UPLOAD_DIR } from './routes/uploads.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  if (!env.isProd) app.use(morgan('dev'));

  // Clerk request context (reads CLERK_* from env)
  app.use(clerkMiddleware());

  // uploaded scouting photos
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }),
    api
  );

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
