/*
 * Security acceptance tests for accounts, organizations and platform administration.
 *
 *   ALLOW_DEV_AUTH=1 AI_MOCK=1 PORT=5075 node src/index.js      (in one terminal)
 *   npm run test:security --workspace server                     (in another)
 *
 * Uses the dev-auth header (x-dev-user), never touches Clerk, and removes everything it created.
 * It never changes a real administrator: the "last administrator" rule is tested only where other
 * administrators exist, so a refused request is the thing being proved.
 */
import fs from 'node:fs';
import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import * as M from '../models/index.js';

const BASE = process.env.TEST_BASE || 'http://localhost:5075/api';
const PREFIX = 'sectest_';
const U = (n) => `${PREFIX}${n}`;
let failures = 0;
let passed = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };

async function call(user, method, path, body) {
  const res = await fetch(BASE + path, { method, headers: { 'x-dev-user': U(user), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* not json */ }
  return { status: res.status, data, code: data?.details?.code };
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const audited = (action, target) => M.AuditLog.exists({ action, ...(target ? { target_id: target } : {}), actor_id: U('admin') });

await connectDB();
const cleanup = async () => {
  const orgs = await M.Organization.find({ created_by: new RegExp(`^${PREFIX}`) }, '_id').lean();
  const ids = orgs.map((o) => o._id);
  await Promise.all([
    M.Organization.deleteMany({ _id: { $in: ids } }),
    M.OrganizationMember.deleteMany({ $or: [{ organization_id: { $in: ids } }, { user_id: new RegExp(`^${PREFIX}`) }, { invited_email: /@sectest\.local$/ }] }),
    M.ReferralLink.deleteMany({ organization_id: { $in: ids } }),
    M.FarmerOrganization.deleteMany({ organization_id: { $in: ids } }),
    M.AuditLog.deleteMany({ $or: [{ organization_id: { $in: ids } }, { actor_id: new RegExp(`^${PREFIX}`) }, { target_id: new RegExp(`^${PREFIX}`) }] }),
    M.Notification.deleteMany({ user_id: new RegExp(`^${PREFIX}`) }),
    M.Profile.deleteMany({ user_id: new RegExp(`^${PREFIX}`) }),
    M.Expense.deleteMany({ user_id: new RegExp(`^${PREFIX}`) }),
    M.Farm.deleteMany({ user_id: new RegExp(`^${PREFIX}`) }),
  ]);
  for (const f of fs.readdirSync(new URL('../../uploads/', import.meta.url))) if (f.startsWith(PREFIX)) fs.unlinkSync(new URL(`../../uploads/${f}`, import.meta.url));
};
await cleanup();

try {
  const mk = (n, extra = {}) => M.Profile.create({ user_id: U(n), email: `${n}@sectest.local`, email_verified: true, account_status: 'active', is_active: true, ...extra });
  await mk('admin', { is_admin: true, full_name: 'Test Admin' });
  await mk('admin2', { is_admin: true, full_name: 'Second Admin' });
  await mk('farmer', { full_name: 'Test Farmer' });
  await mk('pending', { account_status: 'pending', is_active: false });
  await mk('held', { account_status: 'on_hold', is_active: false });

  console.log('1. Who can reach what');
  ok((await call('farmer', 'GET', '/admin/overview')).status === 403, 'a farmer cannot open any admin route');
  ok((await call('farmer', 'GET', '/admin/users')).status === 403, 'a farmer cannot list users');
  ok((await call('farmer', 'PATCH', `/admin/users/${U('farmer')}`, { is_admin: true })).status === 403, 'a farmer cannot make themselves an administrator through the admin route');
  const self = await call('farmer', 'PUT', '/profile', { is_admin: true, role: 'Administrator', account_status: 'active', ai_daily_limit: 9999, user_type: 'org', public_id: 'Crop000000' });
  const mine = await M.Profile.findOne({ user_id: U('farmer') }).lean();
  ok(self.status === 200 && !mine.is_admin && mine.role === 'Farmer' && mine.user_type === 'farmer' && mine.ai_daily_limit == null, 'profile updates cannot set admin, role, account type or limits');
  for (const [who, expected] of [['pending', 403], ['held', 403]]) {
    ok((await call(who, 'GET', '/farms')).status === expected, `a ${who} account cannot read farm data`);
  }
  ok((await call('pending', 'GET', '/ai/status')).status === 403, 'a pending account cannot use the AI');
  ok((await call('pending', 'GET', '/export/farms?format=csv')).status === 403, 'a pending account cannot export');
  ok((await call('farmer', 'GET', '/farms')).status === 200, 'an approved farmer can read their farm data');

  console.log('2. Organization onboarding');
  const reg = await call('orgadmin', 'POST', '/organizations/register', { name: 'Security Test Cooperative', type: 'Cooperative', country: 'Rwanda', full_name: 'Org Admin' });
  ok(reg.status === 201 && reg.data.status === 'pending', 'an organization registers as pending');
  const orgId = reg.data.id;
  ok((await call('orgadmin', 'POST', `/organizations/${orgId}/referral-links`, {})).status === 403, 'it cannot create referral links before approval');
  ok((await call('orgadmin', 'GET', '/farms')).status === 403, 'an organization account is closed out of the farm modules');
  ok((await call('orgadmin', 'GET', '/dashboard')).status === 403, 'and out of the farm dashboard');
  ok((await call('orgadmin', 'GET', '/ai/status')).status === 403, 'and out of the AI');
  ok((await call('orgadmin', 'GET', '/notifications')).status === 200, 'but it keeps its notifications');
  ok((await call('orgadmin', 'GET', `/organizations/${orgId}`)).status === 200, 'and its own organization');
  ok((await call('orgadmin', 'GET', '/admin/organizations')).status === 403, 'it cannot open the platform admin panel');
  ok((await call('orgadmin', 'POST', '/organizations/register', { name: 'Second Org' })).status === 409, 'one account cannot register a second organization');
  ok((await call('farmer', 'POST', '/organizations/register', { name: 'Farmer Org' })).status === 400, 'an approved farmer account cannot be turned into an organization');
  ok((await call('admin', 'POST', '/organizations/register', { name: 'Admin Org' })).status === 400, 'an administrator cannot register an organization');
  ok((await call('orgadmin', 'PATCH', `/organizations/${orgId}`, { status: 'active', max_farmers: 99999, farmer_count: 0, name: 'Security Test Cooperative' })).status === 200, 'an organization can edit its details');
  const orgNow = await M.Organization.findById(orgId).lean();
  ok(orgNow.status === 'pending' && orgNow.max_farmers !== 99999, 'but cannot approve itself or raise its own farmer limit');
  ok((await call('admin', 'PATCH', `/admin/organizations/${orgId}`, { action: 'approve' })).status === 200, 'the platform administrator approves it');
  ok(await audited('organization.approved', undefined) !== null, 'the approval is in the audit log');

  console.log('3. Organization teams and isolation');
  const other = await call('orgbadmin', 'POST', '/organizations/register', { name: 'Security Test Other', type: 'NGO', country: 'Rwanda' });
  const otherId = other.data.id;
  await call('admin', 'PATCH', `/admin/organizations/${otherId}`, { action: 'approve' });
  ok((await call('orgbadmin', 'GET', `/organizations/${orgId}`)).status === 404, 'another organization cannot open this one (same answer as "does not exist")');
  ok((await call('orgbadmin', 'GET', `/organizations/${orgId}/farmers`)).status === 404, 'nor read its farmers');
  ok((await call('orgbadmin', 'DELETE', `/organizations/${orgId}`)).status === 404, 'nor delete it');
  ok((await call('farmer', 'GET', `/organizations/${orgId}/farmers`)).status === 404, 'a farmer cannot open organization routes');
  // invitations: only a verified address can accept
  await call('orgadmin', 'POST', `/organizations/${orgId}/members`, { email: 'unverified@sectest.local', role: 'org_staff' });
  await M.Profile.create({ user_id: U('unverified'), email: 'unverified@sectest.local', email_verified: false, account_status: 'new' });
  const unv = await call('unverified', 'GET', '/me/organization');
  ok(!unv.data?.membership, 'an invitation is not accepted by an unverified email address', JSON.stringify(unv.data));
  await M.Profile.updateOne({ user_id: U('unverified') }, { $set: { email_verified: true } });
  const ver = await call('unverified', 'GET', '/me/organization');
  ok(ver.data?.membership?.role === 'org_staff', 'the same invitation is accepted once the address is verified', JSON.stringify(ver.data));
  ok((await call('unverified', 'GET', '/farms')).status === 403, 'the invited member is an organization account, with no farm data');
  ok((await call('unverified', 'POST', `/organizations/${orgId}/members`, { email: 'x@sectest.local' })).status === 403, 'staff cannot manage the team');
  ok((await call('unverified', 'PATCH', `/organizations/${orgId}`, { name: 'Hijacked' })).status === 403, 'staff cannot edit the organization');
  const members = await call('orgadmin', 'GET', `/organizations/${orgId}/members`);
  const adminRow = members.data.find((m) => m.role === 'org_admin');
  ok((await call('orgadmin', 'DELETE', `/organizations/${orgId}/members/${adminRow.id}`)).status === 400, 'the last organization administrator cannot be removed');
  const link = await call('orgadmin', 'POST', `/organizations/${orgId}/referral-links`, {});
  ok(link.status === 201 && /\/join\/.{40,}/.test(link.data.url), 'a referral link carries a long random token');
  const list = await call('orgadmin', 'GET', `/organizations/${orgId}/referral-links`);
  ok(!JSON.stringify(list.data).includes(link.data.url.split('/join/')[1]), 'the token is never shown again after creation');
  await call('admin', 'PATCH', `/admin/organizations/${orgId}`, { action: 'suspend', reason: 'security test' });
  ok((await call('orgadmin', 'POST', `/organizations/${orgId}/members`, { email: 'late@sectest.local' })).status === 403, 'a suspended organization cannot change anything');
  ok((await call('orgadmin', 'GET', `/organizations/${orgId}/dashboard`)).status === 200, 'but can still look');
  await call('admin', 'PATCH', `/admin/organizations/${orgId}`, { action: 'reactivate' });

  console.log('4. Platform administration');
  ok((await call('admin', 'PATCH', `/admin/users/${U('farmer')}`, { role: 'Superuser' })).status === 400, 'an unknown account type is refused');
  ok((await call('admin', 'PATCH', `/admin/users/${U('farmer')}`, { is_admin: 'yes' })).status === 400, 'a non-boolean admin flag is refused');
  ok((await call('admin', 'PATCH', `/admin/users/${U('farmer')}`, { role: 'Agronomist' })).status === 200 && await audited('user.role_changed', U('farmer')), 'a role change is recorded');
  ok((await call('admin', 'PATCH', `/admin/users/${U('farmer')}`, { account_status: 'on_hold', reason: 'test' })).status === 200 && await audited('user.status_changed', U('farmer')), 'a status change is recorded with its reason');
  ok((await call('farmer', 'GET', '/farms')).status === 403, 'a held account is shut out at once');
  await call('admin', 'PATCH', `/admin/users/${U('farmer')}`, { account_status: 'active' });
  ok((await call('farmer', 'GET', '/farms')).status === 200, 'and back in as soon as it is activated');
  ok((await call('admin', 'PATCH', `/admin/users/${U('farmer')}`, { ai_daily_limit: 7 })).status === 200 && await audited('user.ai_limit_changed', U('farmer')), 'an AI limit change is recorded');
  ok((await call('admin', 'GET', `/admin/users/${U('farmer')}`)).status === 200 && await audited('user.viewed', U('farmer')), 'opening a user record is recorded');
  ok((await call('admin', 'PATCH', `/admin/users/${U('admin')}`, { is_admin: false })).status === 400, 'an administrator cannot revoke their own access');
  ok((await call('admin', 'PATCH', `/admin/users/${U('admin')}`, { account_status: 'deactivated' })).status === 400, 'nor deactivate themselves');
  ok((await call('admin', 'PATCH', `/admin/users/${U('admin2')}`, { account_status: 'deactivated' })).status === 400, 'an administrator cannot be put on hold or deactivated: access must be revoked first');
  ok((await call('admin', 'DELETE', `/admin/users/${U('admin2')}`)).status === 400, 'an administrator account cannot be deleted while it is still an administrator');
  ok((await call('admin', 'DELETE', `/admin/users/${U('admin')}`)).status === 400, 'nobody can delete their own account here');
  await M.Profile.create({ user_id: U('envadmin'), email: env.adminEmails[0] || 'configured@sectest.local', email_verified: true, is_admin: true, account_status: 'active', is_active: true });
  if (env.adminEmails[0]) {
    const r = await call('admin', 'PATCH', `/admin/users/${U('envadmin')}`, { is_admin: false });
    ok(r.status === 400 && r.code === 'admin_in_env', 'revoking an administrator named in the server settings is refused (they would be re-granted at the next sign-in)', JSON.stringify(r.data));
  }
  ok((await call('admin', 'PATCH', `/admin/users/${U('admin2')}`, { is_admin: false })).status === 200 && await audited('user.admin_revoked', U('admin2')), 'revoking another administrator works while others remain, and is recorded');
  ok((await call('admin', 'PATCH', `/admin/users/${U('admin2')}`, { is_admin: true })).status === 200 && await audited('user.admin_granted', U('admin2')), 'granting administrator access is recorded');
  const farm = await M.Farm.create({ user_id: U('farmer'), name: 'Security test farm' });
  ok((await call('admin', 'GET', `/admin/data/farms/${farm._id}`)).status === 200 && await audited('data.record_viewed', String(farm._id)), 'inspecting a farmer\'s record is recorded');
  ok((await call('admin', 'DELETE', `/admin/data/farms/${farm._id}`)).status === 200 && await audited('data.record_deleted', String(farm._id)), 'deleting a farmer\'s record is recorded');
  ok((await call('admin', 'POST', '/admin/settings/admins', { email: 'new.admin@sectest.local' })).status === 200 && await audited('admin_allowlist.added', 'new.admin@sectest.local'), 'adding an administrator email is recorded');
  ok((await call('admin', 'DELETE', `/admin/settings/admins/${encodeURIComponent('new.admin@sectest.local')}`)).status === 200 && await audited('admin_allowlist.removed', 'new.admin@sectest.local'), 'removing it is recorded');
  ok((await call('admin', 'PUT', '/admin/settings/ai-limits', { daily: 40, hourly: 15 })).status === 200 && await audited('ai.limits_updated', undefined), 'changing the AI limits is recorded');
  const log = await call('admin', 'GET', '/admin/audit-logs?perPage=5');
  ok(log.status === 200 && log.data.data.length > 0, 'the audit log is readable by an administrator');
  ok((await call('farmer', 'GET', '/admin/audit-logs')).status === 403, 'and by nobody else');
  ok((await call('admin', 'DELETE', '/admin/audit-logs')).status === 404, 'there is no way to delete the audit log through the API');
  let limited = 0;
  for (let i = 0; i < 45; i += 1) if ((await call('admin', 'PATCH', `/admin/users/${U('farmer')}`, { role: 'Agronomist' })).status === 429) limited += 1;
  ok(limited > 0, 'a burst of administrator changes is slowed down', String(limited));

  console.log('5. Uploads');
  const up = async (user, type = 'image/png', name = 'a.png', bytes = png) => {
    const f = new FormData();
    f.append('file', new Blob([bytes], { type }), name);
    const r = await fetch(`${BASE}/uploads`, { method: 'POST', headers: { 'x-dev-user': U(user) }, body: f });
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  const a = await up('farmer');
  const b = await up('farmer');
  ok(a.status === 201 && /-[0-9a-f]{12}\.jpg$/.test(a.data.url) && a.data.url !== b.data.url, 'an uploaded picture gets an address that cannot be guessed');
  ok((await up('farmer', 'text/plain', 'x.txt', Buffer.from('words'))).status === 400, 'a non-picture is refused');
  ok((await up('pending')).status === 403 && (await up('orgadmin')).status === 403, 'unapproved and organization accounts cannot upload');

  console.log('6. Export by recording period');
  for (const [d, amt] of [['2026-01-10', 10], ['2026-02-15', 20], ['2026-03-20', 30]]) await M.Expense.create({ user_id: U('farmer'), category: 'Seeds', amount: amt, expense_date: d, description: `exp ${d}` });
  const csv = async (qs) => {
    const r = await fetch(`${BASE}/export/expenses?format=csv${qs}`, { headers: { 'x-dev-user': U('farmer') } });
    const t = await r.text();
    const lines = r.status === 200 ? t.split(String.fromCharCode(10)).map((l) => l.replace(/﻿/g, '').trim()).filter(Boolean) : [];
    return { status: r.status, rows: Math.max(0, lines.length - 1), text: t };
  };
  ok((await csv('')).rows === 3, 'with no period everything is exported');
  ok((await csv('&from=2026-02-01&to=2026-02-28')).rows === 1, 'a period keeps only the records dated inside it');
  ok((await csv('&from=2026-02-15&to=2026-03-20')).rows === 2, 'both ends of the period are included');
  ok((await csv('&from=2026-03-01')).rows === 1, 'a start date alone means "from then on"');
  ok((await csv('&to=2026-01-31')).rows === 1, 'an end date alone means "up to then"');
  ok((await csv('&from=2030-01-01&to=2030-12-31')).rows === 0, 'a period with nothing in it gives an empty file');
  ok((await csv('&from=01-02-2026')).status === 400, 'a badly written date is refused');
  ok((await csv('&from=2026-03-01&to=2026-02-01')).status === 400, 'a period that ends before it starts is refused');
  ok((await csv('&from=2026-02-01&to=2026-02-28&q=exp')).rows === 1, 'the period combines with the search on the page');
  const allRes = async (qs) => (await fetch(`${BASE}/export?format=xlsx${qs}`, { headers: { 'x-dev-user': U('farmer') } })).status;
  ok((await allRes('')) === 200, 'exporting everything works with no period');
  ok((await allRes('&from=2026-02-01&to=2026-02-28')) === 200, 'and for a period');
  ok((await allRes('&from=2030-01-01&to=2030-01-02')) === 404, 'and says so when the period holds nothing');
  const farmToday = await M.Farm.create({ user_id: U('farmer'), name: 'Period farm' });
  const today = new Date().toISOString().slice(0, 10);
  const farms = async (qs) => (await (await fetch(`${BASE}/export/farms?format=csv${qs}`, { headers: { 'x-dev-user': U('farmer') } })).text()).includes('Period farm');
  ok(await farms(`&from=${today}&to=${today}`), 'records without a date of their own follow the day they were created (inside the period)');
  ok(!(await farms('&from=2020-01-01&to=2020-12-31')), 'and stay out of an earlier period');
  await farmToday.deleteOne();

  console.log('7. Deleting an account removes everything of theirs');
  await mk('leaver', { full_name: 'Leaver' });
  const pic = await up('leaver');
  const picFile = new URL(`../../uploads/${pic.data.url.split('/').pop()}`, import.meta.url);
  await M.Farm.create({ user_id: U('leaver'), name: 'Leaver farm' });
  ok(fs.existsSync(picFile), 'the picture is on the server before deletion');
  const gone = await call('admin2', 'DELETE', `/admin/users/${U('leaver')}`);
  ok(gone.status === 200 && gone.data.pictures_removed >= 1, 'the account is deleted and says how many pictures went', JSON.stringify(gone.data));
  ok(!fs.existsSync(picFile), 'the picture file is gone from the server');
  ok((await M.Farm.countDocuments({ user_id: U('leaver') })) === 0 && !(await M.Profile.exists({ user_id: U('leaver') })), 'their records and profile are gone');
  ok((await M.AuditLog.exists({ action: 'user.deleted', target_id: U('leaver') })) !== null, 'and the deletion is recorded with who did it');
} finally {
  await cleanup();
  await disconnectDB();
}
console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
