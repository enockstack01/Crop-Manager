/**
 * Farmer invitations by email:
 *
 *   ALLOW_DEV_AUTH=1 AI_MOCK=1 PORT=5075 node src/index.js      (in one terminal)
 *   node src/scripts/test-invites.mjs                            (in another)
 *
 * Test mode never sends real email (the invitation is recorded and reported as "invited_test"). Uses the dev-auth header and
 * removes everything it creates.
 */
import { connectDB } from '../config/db.js';
import * as M from '../models/index.js';

const BASE = process.env.TEST_BASE || 'http://localhost:5075/api';
const P = 'invtest_';
const U = (n) => `${P}${n}`;
let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };
async function call(user, method, path, body) {
  const res = await fetch(BASE + path, { method, headers: { 'x-dev-user': U(user), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* none */ }
  return { status: res.status, data };
}

await connectDB();
const re = new RegExp(`^${P}`);
const cleanup = async () => {
  const orgs = await M.Organization.find({ created_by: re }, '_id').lean();
  const ids = orgs.map((o) => o._id);
  await Promise.all([
    M.Organization.deleteMany({ _id: { $in: ids } }), M.OrganizationMember.deleteMany({ organization_id: { $in: ids } }),
    M.FarmerInvite.deleteMany({ organization_id: { $in: ids } }), M.FarmerOrganization.deleteMany({ organization_id: { $in: ids } }),
    M.AuditLog.deleteMany({ $or: [{ organization_id: { $in: ids } }, { actor_id: re }] }), M.Notification.deleteMany({ user_id: re }),
    M.Profile.deleteMany({ user_id: re }),
  ]);
};
await cleanup();

try {
  await M.Profile.create({ user_id: U('sys'), is_admin: true, account_status: 'active', is_active: true, email: 'sys@invtest.local', email_verified: true });
  const reg = await call('org', 'POST', '/organizations/register', { name: 'Invite Test Cooperative', type: 'Cooperative', country: 'Rwanda', full_name: 'Org Admin' });
  const org = reg.data.id;
  await call('sys', 'PATCH', `/admin/organizations/${org}`, { action: 'approve', max_farmers: 2, reason: 'test' });

  console.log('1. importing emails with no account');
  const csv = 'email\nnew.farmer@invtest.local\nsecond.farmer@invtest.local\nnot-an-email\nnew.farmer@invtest.local';
  const noConsent = await call('sys', 'POST', `/admin/organizations/${org}/import-farmers`, { csv });
  ok(noConsent.status === 400, 'consent must be confirmed first');
  const imp = await call('sys', 'POST', `/admin/organizations/${org}/import-farmers`, { csv, consent_confirmed: true });
  const rows = Object.fromEntries((imp.data?.rows || []).map((r) => [r.email, r.result]));
  ok(imp.status === 200 && imp.data.invited === 2, 'two invitations are made (a repeated address counts once)', JSON.stringify(imp.data));
  ok(rows['new.farmer@invtest.local'] === 'invited_test' && rows['not-an-email'] === 'invalid_email', 'each row says what happened', JSON.stringify(rows));
  ok((await M.FarmerInvite.countDocuments({ organization_id: org, status: 'invited' })) === 2, 'the invitations are stored');
  const again = await call('sys', 'POST', `/admin/organizations/${org}/import-farmers`, { csv: 'new.farmer@invtest.local', consent_confirmed: true });
  ok(again.status === 200 && (await M.FarmerInvite.countDocuments({ organization_id: org, email: 'new.farmer@invtest.local' })) === 1, 'inviting the same person again does not create a second invitation');

  console.log('2. the invited person signs up');
  await M.Profile.create({ user_id: U('f1'), email: 'new.farmer@invtest.local', email_verified: false, account_status: 'new' });
  let me = await call('f1', 'GET', '/me/organization');
  ok(me.status === 200 && !me.data.farmer_org, 'an unverified address is not linked');
  await M.Profile.updateOne({ user_id: U('f1') }, { $set: { email_verified: true } });
  me = await call('f1', 'GET', '/me/organization');
  ok(me.data?.farmer_org?.organization?.name === 'Invite Test Cooperative', 'a verified address is linked to the organization at sign-in', JSON.stringify(me.data));
  const prof = await M.Profile.findOne({ user_id: U('f1') }).lean();
  ok(prof.account_status === 'pending', 'the farmer then waits for the administrator\'s approval, as for any referred farmer', prof.account_status);
  ok((await M.FarmerInvite.findOne({ organization_id: org, email: 'new.farmer@invtest.local' }).lean()).status === 'joined', 'the invitation is marked as used');
  ok((await M.Organization.findById(org).lean()).farmer_count === 1, 'the organization count went up by one');
  ok(!!(await M.AuditLog.findOne({ action: 'farmer.joined', target_id: U('f1') }).lean()), 'the join is in the audit log');
  me = await call('f1', 'GET', '/me/organization');
  ok((await M.Organization.findById(org).lean()).farmer_count === 1, 'signing in again does not count the farmer twice');

  console.log('3. limits and wrong cases');
  await M.Profile.create({ user_id: U('f2'), email: 'second.farmer@invtest.local', email_verified: true, account_status: 'new' });
  await M.FarmerInvite.updateOne({ organization_id: org, email: 'second.farmer@invtest.local' }, { $set: { expires_at: new Date(Date.now() - 1000) } });
  me = await call('f2', 'GET', '/me/organization');
  ok(!me.data.farmer_org, 'an expired invitation does nothing');
  await M.FarmerInvite.updateOne({ organization_id: org, email: 'second.farmer@invtest.local' }, { $set: { expires_at: new Date(Date.now() + 86400000) } });
  await M.Organization.updateOne({ _id: org }, { $set: { max_farmers: 1 } });
  me = await call('f2', 'GET', '/me/organization');
  ok(me.status === 200 && !me.data.farmer_org, 'when the organization is full the farmer is not linked and nothing breaks');
  ok((await M.FarmerInvite.findOne({ organization_id: org, email: 'second.farmer@invtest.local' }).lean()).status === 'invited', 'the invitation stays open for when there is room');
  await M.Organization.updateOne({ _id: org }, { $set: { max_farmers: 5 } });
  me = await call('f2', 'GET', '/me/organization');
  ok(me.data?.farmer_org?.organization?.name === 'Invite Test Cooperative', 'and the farmer is linked once there is room');

  await M.Profile.create({ user_id: U('adm2'), email: 'new.admin@invtest.local', email_verified: true, is_admin: true, account_status: 'active' });
  await M.FarmerInvite.create({ organization_id: org, email: 'new.admin@invtest.local', status: 'invited', expires_at: new Date(Date.now() + 86400000) });
  me = await call('adm2', 'GET', '/me/organization');
  ok(!me.data.farmer_org, 'a platform administrator is never turned into a farmer by an invitation');

  console.log('4. team invitations');
  const inv = await call('org', 'POST', `/organizations/${org}/members`, { email: 'new.officer@invtest.local', role: 'org_staff' });
  ok(inv.status === 201 && 'email_sent' in inv.data, 'inviting a team member reports whether the email went out', JSON.stringify(inv.data));
} finally {
  await cleanup();
}
console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
