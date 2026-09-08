import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

const CONNECT_OPTS = { serverSelectionTimeoutMS: 15000, maxPoolSize: 20 };

export async function connectDB() {
  mongoose.connection.on('connected', () => console.log('[db] MongoDB connected'));
  mongoose.connection.on('error', (err) => console.error('[db] MongoDB error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('[db] MongoDB disconnected'));

  // Optional explicit resolvers for environments whose default DNS can't do SRV lookups.
  if (process.env.DNS_SERVERS) {
    dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()));
  }

  try {
    await mongoose.connect(env.mongoUri, CONNECT_OPTS);
  } catch (err) {
    const srvFailure = err?.syscall === 'querySrv' || /querySrv|ENOTFOUND|ECONNREFUSED/.test(err?.message || '');
    if (srvFailure && env.mongoUri.startsWith('mongodb+srv://')) {
      console.warn('[db] SRV lookup failed via system DNS — retrying with public resolvers (1.1.1.1, 8.8.8.8)');
      dns.setServers(['1.1.1.1', '8.8.8.8']);
      await mongoose.connect(env.mongoUri, CONNECT_OPTS);
    } else {
      throw err;
    }
  }
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
