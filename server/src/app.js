import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { limiter as rateLimit } from './lib/rateLimit.js';
import compression from 'compression';
import { clerkSession } from './middleware/clerkSession.js';

import { env } from './config/env.js';
import api from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.js';
import { UPLOAD_DIR } from './routes/uploads.routes.js';
import { SAFE_NAME, storage } from './lib/storage.js';
import { cspDirectives } from './lib/csp.js';

// built web client (npm run build → client/dist); served by this same server in
// production so the website, its API and the mobile app share one deployment
const WEB_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

/** A repeated query key (?q=a&q=b) arrives as a list; the code expects one text value, so the last one wins. */
function oneValuePerQueryKey(req, _res, next) {
  for (const key of Object.keys(req.query)) {
    const v = req.query[key];
    if (Array.isArray(v)) req.query[key] = String(v[v.length - 1] ?? '');
  }
  next();
}

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  // flat query strings only (?a=1&b=2): the default parser turns ?farm_id[$ne]=x into an object that reaches the database as an
  // operator, and it is the parser behind the qs denial-of-service advisories
  app.set('query parser', 'simple');
  app.use(compression());
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: { useDefaults: false, directives: cspDirectives(env.clerkPublishableKey, { isProd: env.isProd }) },
    })
  );
  app.use(cors({ origin: env.clientOrigin, credentials: true, maxAge: 600 }));
  app.use(express.json({ limit: '2mb' }));
  if (!env.isProd) app.use(morgan('dev'));

  // Clerk request context (reads CLERK_* from env)
  app.use(clerkSession);

  // uploaded scouting photos
  // every file has its own random name and is never changed, so browsers may keep it; nothing in this folder may run as a page
  const sandbox = (res) => res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  if (storage.name === 'local') {
    app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true, setHeaders: sandbox }));
  } else {
    // pictures kept in a private bucket are read by the server and sent with the same headers as local files
    app.get('/uploads/:name', async (req, res, next) => {
      try {
        if (!SAFE_NAME.test(req.params.name)) return res.status(404).end();
        const bytes = await storage.get(req.params.name);
        if (!bytes) return res.status(404).end();
        sandbox(res);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
        return res.end(bytes);
      } catch (err) {
        return next(err);
      }
    });
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
  // ready = able to serve real requests (database connected). A load balancer or uptime monitor should use this one.
  app.get('/api/ready', (_req, res) => {
    const db = mongoose.connection.readyState === 1;
    res.status(db ? 200 : 503).json({ ready: db, database: db ? 'connected' : 'not connected', ts: Date.now() });
  });

  app.use(
    '/api',
    rateLimit({ name: 'api', windowMs: 60_000, max: 300 }),
    oneValuePerQueryKey,
    api
  );

  if (env.isProd && fs.existsSync(WEB_DIST)) {
    // the build gives its files names that change with their content, so those can be kept for a year; the page itself must be re-checked
    app.use(express.static(WEB_DIST, {
      index: false,
      maxAge: '1h',
      setHeaders: (res, file) => {
        if (/[\\/]assets[\\/]/.test(file)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }));
    // client-side routes (/farms, /reports, …) all load the SPA shell
    app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(WEB_DIST, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
