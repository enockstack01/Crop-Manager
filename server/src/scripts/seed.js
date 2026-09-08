/**
 * Demo data seeder for a single user.
 *
 *   npm run seed -- <clerkUserId>
 *   SEED_USER_ID=<clerkUserId> npm run seed
 *
 * Optional: SEED_NAME, SEED_ROLE to set the profile.
 */
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { seedUser } from '../lib/seedData.js';

const userId = process.argv[2] || process.env.SEED_USER_ID;
if (!userId) {
  console.error('Usage: npm run seed -- <clerkUserId>');
  process.exit(1);
}

const run = async () => {
  await connectDB();
  console.log(`[seed] target user: ${userId}`);
  const counts = await seedUser(userId, {
    profile: { full_name: process.env.SEED_NAME, role: process.env.SEED_ROLE },
  });
  console.log('[seed] done:');
  for (const [name, n] of Object.entries(counts)) console.log(`  ${name.padEnd(24)} ${n}`);
  await disconnectDB();
  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error('[seed] failed:', err);
  await disconnectDB();
  process.exit(1);
});
