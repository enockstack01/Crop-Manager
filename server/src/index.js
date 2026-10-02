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

  const shutdown = (signal) => {
    console.log(`\n[server] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] fatal startup error:', err);
  process.exit(1);
});
