/*
 * Organization accounts migration (Logistack specification, section 12).
 *
 *   npm run migrate-orgs --workspace server            apply (safe to run again)
 *   npm run migrate-orgs --workspace server -- --dry   show what would change
 *   npm run migrate-orgs --workspace server -- --rollback --yes   undo
 *
 * Apply: every existing profile becomes a farmer (user_type farmer) with no organization, existing
 * administrators stay system administrators, and the new collections and their indexes are created.
 * Nothing is deleted and no farmer loses access. Rollback removes user_type from profiles and drops the
 * organization collections (the audit log included), so run a backup first.
 */
import { connectDB, disconnectDB } from '../config/db.js';
import * as M from '../models/index.js';

const args = new Set(process.argv.slice(2));
await connectDB();
try {
  if (args.has('--rollback')) {
    if (!args.has('--yes')) {
      console.log('Rollback drops organizations, members, referral links, farmer links and the audit log. Run again with --yes to confirm.');
    } else {
      const r = await M.Profile.updateMany({}, { $unset: { user_type: '' } });
      for (const Model of [M.Organization, M.OrganizationMember, M.ReferralLink, M.FarmerOrganization, M.AuditLog]) {
        await Model.collection.drop().catch(() => {});
      }
      await M.SystemSetting.deleteOne({ key: 'org_settings' });
      console.log(`Rolled back: user_type removed from ${r.modifiedCount} profile(s); organization collections dropped.`);
    }
  } else {
    const missing = await M.Profile.countDocuments({ user_type: { $exists: false } });
    const admins = await M.Profile.countDocuments({ is_admin: true });
    console.log(`${missing} profile(s) without a user type; ${admins} system administrator(s).`);
    if (!args.has('--dry')) {
      const r = await M.Profile.updateMany({ user_type: { $exists: false } }, { $set: { user_type: 'farmer' } });
      for (const Model of [M.Organization, M.OrganizationMember, M.ReferralLink, M.FarmerOrganization, M.AuditLog]) await Model.syncIndexes();
      console.log(`Set user_type farmer on ${r.modifiedCount} profile(s); organization collections and indexes are ready.`);
    }
  }
} finally {
  await disconnectDB();
}
