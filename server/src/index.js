import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { runMigrations } from './lib/migrations.js';

async function main() {
  await connectDB();
  await runMigrations();
  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[server] API listening on http://localhost:${env.port}  (env: ${env.nodeEnv})`);
  });

  // the proxy in front (Render, nginx) keeps idle connections for up to 60 s; closing ours sooner causes random 502 errors
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  const shutdown = (signal) => {
    console.log(`\n[server] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// One request that fails in the background must not take every farmer's session down: log it and keep serving.
// A truly unexpected exception leaves the process in an unknown state, so it is logged and the process manager restarts it.
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled promise rejection:', reason instanceof Error ? reason.stack || reason.message : String(reason));
});
process.on('uncaughtException', (err) => {
  console.error('[server] uncaught exception, exiting so it restarts clean:', err?.stack || err);
  process.exit(1);
});

main().catch((err) => {
  console.error('[server] fatal startup error:', err);
  process.exit(1);
});
