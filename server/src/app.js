import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

// built web client (npm run build → client/dist); served by this same server in
// production so the website, its API and the mobile app share one deployment
const WEB_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // the web client loads Clerk, Google Fonts and Font Awesome from their CDNs;
      // helmet's default CSP would block them
      contentSecurityPolicy: false,
    })
  );
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

  if (env.isProd && fs.existsSync(WEB_DIST)) {
    app.use(express.static(WEB_DIST, { index: false, maxAge: '1h' }));
    // client-side routes (/farms, /reports, …) all load the SPA shell
    app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
