/**
 * Grant platform admin to an email and (optionally) seed that account.
 *
 *   npm run grant-admin -- <email> [--seed]
 *
 * Adds the email to the DB-managed allowlist, promotes an existing user if found,
 * and creates the Clerk user if it does not exist yet.
 */
import mongoose from 'mongoose';
import { createClerkClient } from '@clerk/express';
import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { addAdminEmail } from '../lib/adminAllowlist.js';
import { seedUser } from '../lib/seedData.js';
import { Profile } from '../models/index.js';

const email = (process.argv[2] || '').trim().toLowerCase();
const doSeed = process.argv.includes('--seed');
if (!email) {
  console.error('Usage: npm run grant-admin -- <email> [--seed]');
  process.exit(1);
}

const clerk = createClerkClient({ secretKey: env.clerkSecretKey });

const run = async () => {
  await connectDB();

  await addAdminEmail(email, 'grant-admin script');
  console.log(`[grant-admin] ${email} added to admin allowlist`);

  const list = await clerk.users.getUserList({ emailAddress: [email], limit: 1 });
  let user = (Array.isArray(list) ? list : list.data)[0];
  if (!user) {
    user = await clerk.users.createUser({
      emailAddress: [email],
      password: process.env.DEMO_PASSWORD || 'CropManager!2026',
      skipPasswordChecks: true,
    });
    console.log(`[grant-admin] created Clerk user ${user.id}`);
  } else {
    console.log(`[grant-admin] found Clerk user ${user.id}`);
  }

  await Profile.findOneAndUpdate(
    { user_id: user.id },
    { $set: { email, is_admin: true, is_active: true }, $setOnInsert: { user_id: user.id, role: 'Administrator' } },
    { upsert: true }
  );
  console.log('[grant-admin] profile promoted to admin');

  if (doSeed) {
    const p = await Profile.findOne({ user_id: user.id }).lean();
    const counts = await seedUser(user.id, {
      profile: { full_name: p.full_name || 'Platform Admin', role: p.role || 'Administrator', location: p.location, phone: p.phone },
    });
    console.log(`[grant-admin] seeded ${Object.values(counts).reduce((s, n) => s + n, 0)} records`);
  }

  await disconnectDB();
  await mongoose.connection.close();
  console.log('[grant-admin] done');
};

run().catch(async (err) => {
  console.error('[grant-admin] failed:', err);
  await disconnectDB();
  process.exit(1);
});
