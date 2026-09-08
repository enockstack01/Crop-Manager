import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`\n[config] Missing required env var: ${name}`);
    console.error('[config] Copy .env.example to server/.env and fill it in.\n');
    process.exit(1);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  mongoUri: required('MONGODB_URI'),
  clerkPublishableKey: required('CLERK_PUBLISHABLE_KEY'),
  clerkSecretKey: required('CLERK_SECRET_KEY'),
  get isProd() {
    return this.nodeEnv === 'production';
  },
};
