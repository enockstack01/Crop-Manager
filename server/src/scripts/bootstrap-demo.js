/**
 * One-shot demo bootstrap: create a set of Clerk users (if they don't exist),
 * seed each with a full realistic dataset, and mark the admin account.
 *
 *   npm run bootstrap-demo
 *
 * Idempotent — re-running re-seeds the same users.
 */
import mongoose from 'mongoose';
import { createClerkClient } from '@clerk/express';
import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { seedUser } from '../lib/seedData.js';
import { Profile } from '../models/index.js';

const clerk = createClerkClient({ secretKey: env.clerkSecretKey });

const PASSWORD = process.env.DEMO_PASSWORD || 'CropManager!2026';

const USERS = [
  {
    email: env.adminEmails[0] || 'admin+clerk_test@example.com',
    first: 'Enock', last: 'Nshimiyimana',
    profile: { full_name: 'Enock Nshimiyimana', role: 'Administrator', location: 'Lusaka, Zambia' },
    admin: true,
    farmA: { name: 'Green Valley Estate', code: 'GVE' },
    farmB: { name: 'Kafue Riverside Farm', code: 'KRF' },
  },
  {
    email: 'demo.grower+clerk_test@example.com',
    first: 'Grace', last: 'Mwansa',
    profile: { full_name: 'Grace Mwansa', role: 'Farmer', location: 'Mkushi, Zambia' },
    farmA: { name: 'Mwansa Family Farm', code: 'MFF' },
    farmB: { name: 'Mkushi Block C', code: 'MBC' },
  },
  {
    email: 'demo.coop+clerk_test@example.com',
    first: 'Joseph', last: 'Banda',
    profile: { full_name: 'Joseph Banda', role: 'Cooperative Manager', location: 'Chipata, Zambia' },
    farmA: { name: 'Chipata Cooperative Fields', code: 'CCF' },
    farmB: { name: 'Eastern Growers Block', code: 'EGB' },
  },
];

async function ensureUser(spec) {
  const existing = await clerk.users.getUserList({ emailAddress: [spec.email], limit: 1 });
  const found = (Array.isArray(existing) ? existing : existing.data)[0];
  if (found) {
    console.log(`  exists: ${spec.email} -> ${found.id}`);
    return found.id;
  }
  const created = await clerk.users.createUser({
    emailAddress: [spec.email],
    password: PASSWORD,
    firstName: spec.first,
    lastName: spec.last,
    skipPasswordChecks: true,
  });
  console.log(`  created: ${spec.email} -> ${created.id}`);
  return created.id;
}

const run = async () => {
  await connectDB();
  console.log('[bootstrap] creating / seeding demo users\n');

  for (const spec of USERS) {
    const userId = await ensureUser(spec);
    const counts = await seedUser(userId, { profile: spec.profile, farmA: spec.farmA, farmB: spec.farmB });
    await Profile.updateOne(
      { user_id: userId },
      { $set: { email: spec.email, is_admin: !!spec.admin, is_active: true, account_status: 'active' } }
    );
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    console.log(`    seeded ${total} records${spec.admin ? '  [ADMIN]' : ''}\n`);
  }

  console.log('[bootstrap] done.');
  console.log(`\nSign in at http://localhost:5173 with any of:`);
  for (const u of USERS) console.log(`  ${u.email}${u.admin ? '   (admin)' : ''}`);
  console.log(`\nPassword for all demo accounts: ${PASSWORD}`);
  console.log('(test-mode emails use Clerk verification code 424242; change the password after first sign-in)');

  await disconnectDB();
  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error('[bootstrap] failed:', err);
  await disconnectDB();
  process.exit(1);
});
