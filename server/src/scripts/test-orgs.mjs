/*
 * Acceptance tests for organization accounts and referral links (specification section 13).
 *
 *   ALLOW_DEV_AUTH=1 AI_MOCK=1 PORT=5075 node src/index.js      (in one terminal)
 *   npm run test:orgs --workspace server                         (in another)
 *
 * Uses the dev-auth header (x-dev-user), so it never touches Clerk, and removes everything it created.
 */
import { connectDB, disconnectDB } from '../config/db.js';
import * as M from '../models/index.js';
import { seedUser, clearUser } from '../lib/seedData.js';

const BASE = process.env.TEST_BASE || 'http://localhost:5075/api';
const PREFIX = 'orgtest_';
const U = (name) => `${PREFIX}${name}`;
let failures = 0;
let passed = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); }
};

async function call(user, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'x-dev-user': U(user), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* not json */ }
  return { status: res.status, data, code: data?.details?.code };
}
const pub = async (path) => {
  const res = await fetch(BASE + path);
  let data = null;
  try { data = await res.json(); } catch { /* */ }
  return { status: res.status, data, code: data?.details?.code };
};
const tokenOf = (url) => url.split('/join/')[1];

await connectDB();
const cleanup = async () => {
  const orgs = await M.Organization.find({ created_by: new RegExp(`^${PREFIX}`) }, '_id').lean();
  const ids = orgs.map((o) => o._id);
  await Promise.all([
    M.Organization.deleteMany({ _id: { $in: ids } }),
    M.OrganizationMember.deleteMany({ organization_id: { $in: ids } }),
    M.ReferralLink.deleteMany({ organization_id: { $in: ids } }),
    M.FarmerOrganization.deleteMany({ organization_id: { $in: ids } }),
    M.AuditLog.deleteMany({ $or: [{ organization_id: { $in: ids } }, { actor_id: new RegExp(`^${PREFIX}`) }] }),
    M.Notification.deleteMany({ user_id: new RegExp(`^${PREFIX}`) }),
    M.Profile.deleteMany({ user_id: new RegExp(`^${PREFIX}`) }),
    M.SystemSetting.deleteOne({ key: 'org_settings' }),
  ]);
};
await cleanup();

try {
  // a system administrator, created directly
  await M.Profile.create({ user_id: U('sysadmin'), is_admin: true, account_status: 'active', is_active: true, email: 'sys@test.local' });

  console.log('1. Organization registration and approval');
  const reg = await call('orgA', 'POST', '/organizations/register', { name: 'Test Cooperative A', type: 'Cooperative', country: 'Rwanda', district: 'Huye', full_name: 'Org A Admin' });
  ok(reg.status === 201 && reg.data.status === 'pending', 'organization registers as pending', JSON.stringify(reg.data));
  const orgA = reg.data.id;
  const early = await call('orgA', 'POST', `/organizations/${orgA}/referral-links`, {});
  ok(early.status === 403 && early.code === 'org_pending', 'a pending organization cannot create links');
  const dup = await call('orgB', 'POST', '/organizations/register', { name: 'test cooperative a' });
  ok(dup.status === 409 && dup.code === 'name_taken', 'organization names are unique ignoring case');
  const noReason = await call('sysadmin', 'PATCH', `/admin/organizations/${orgA}`, { action: 'approve', max_farmers: 2 });
  ok(noReason.status === 400 && noReason.code === 'reason_required', 'changing the farmer limit needs a reason');
  const notAdmin = await call('orgA', 'PATCH', `/admin/organizations/${orgA}`, { action: 'approve' });
  ok(notAdmin.status === 403, 'an organization admin cannot approve or set limits');
  const appr = await call('sysadmin', 'PATCH', `/admin/organizations/${orgA}`, { action: 'approve', max_farmers: 2, reason: 'pilot size' });
  ok(appr.status === 200 && appr.data.status === 'active' && appr.data.max_farmers === 2, 'system admin approves and sets the limit');
  const logs = await call('sysadmin', 'GET', '/admin/audit-logs?action=organization.limit_changed');
  const entry = logs.data?.data?.find((l) => l.details?.new === 2);
  ok(entry && entry.details.old === 100 && entry.details.reason === 'pilot size', 'the limit change is in the audit log with old value, new value and reason');

  console.log('2. Second organization and isolation');
  const regB = await call('orgB', 'POST', '/organizations/register', { name: 'Test NGO B', type: 'NGO' });
  const orgB = regB.data.id;
  await call('sysadmin', 'PATCH', `/admin/organizations/${orgB}`, { action: 'approve' });
  ok((await call('orgB', 'GET', `/organizations/${orgA}`)).status === 404, 'organization B cannot open organization A');
  ok((await call('orgB', 'GET', `/organizations/${orgA}/farmers`)).status === 404, 'organization B cannot list A farmers');
  ok((await call('orgB', 'GET', `/organizations/${orgA}/dashboard`)).status === 404, 'organization B cannot read A dashboard');
  ok((await call('orgB', 'POST', `/organizations/${orgA}/referral-links`, {})).status === 404, 'organization B cannot create links for A');

  console.log('3. Referral link validity (server time)');
  const mk = async () => (await call('orgA', 'POST', `/organizations/${orgA}/referral-links`, { label: 'field day', max_uses: 50 })).data;
  const l1 = await mk();
  const exp = new Date(l1.expires_at).getTime() - Date.now();
  ok(exp > 5.99 * 3_600_000 && exp <= 6 * 3_600_000, 'a link expires six hours after creation', String(exp));
  ok((await pub(`/join/${tokenOf(l1.url)}`)).status === 200, 'a new link opens');
  const stored = await M.ReferralLink.findById(l1.id).lean();
  ok(stored.token_hash && !JSON.stringify(stored).includes(tokenOf(l1.url)), 'only the hash of the token is stored');
  // opened in time, submitted after the six hours
  await M.ReferralLink.updateOne({ _id: l1.id }, { $set: { expires_at: new Date(Date.now() + 1500) } });
  ok((await pub(`/join/${tokenOf(l1.url)}`)).status === 200, 'still valid just before the deadline');
  await new Promise((r) => setTimeout(r, 1800));
  const late = await call('late1', 'POST', `/join/${tokenOf(l1.url)}`, { consent: true });
  ok(late.status === 410 && late.code === 'expired', 'a submission after the deadline is rejected');
  ok((await pub(`/join/${tokenOf(l1.url)}`)).code === 'expired', 'an expired link no longer opens');
  const l2 = await mk();
  await call('orgA', 'DELETE', `/organizations/${orgA}/referral-links/${l2.id}`);
  ok((await pub(`/join/${tokenOf(l2.url)}`)).code === 'revoked', 'a revoked link stops working immediately');
  ok((await pub('/join/not-a-real-token')).code === 'invalid', 'an unknown token is invalid');
  const noConsent = await call('c1', 'POST', `/join/${tokenOf((await mk()).url)}`, {});
  ok(noConsent.status === 400 && noConsent.code === 'consent_required', 'joining needs the farmer consent');

  console.log('4. Farmer limit under concurrent joins (limit 2, 8 farmers at once)');
  const l3 = await mk();
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => call(`farmer${i}`, 'POST', `/join/${tokenOf(l3.url)}`, { consent: true })));
  const joined = results.filter((r) => r.status === 200).length;
  const limited = results.filter((r) => r.code === 'org_limit').length;
  ok(joined === 2 && limited === 6, 'exactly 2 join and 6 are told the organization is full', `joined=${joined} limited=${limited}`);
  const afterOrg = await M.Organization.findById(orgA).lean();
  ok(afterOrg.farmer_count === 2, 'the stored farmer count is 2', String(afterOrg.farmer_count));
  ok((await M.FarmerOrganization.countDocuments({ organization_id: orgA, status: 'active' })) === 2, 'two active farmer links exist');
  const lnk = await M.ReferralLink.findById(l3.id).lean();
  ok(lnk.use_count === 2, 'the link use count matches the farmers who joined', String(lnk.use_count));
  const winners = results.map((r, i) => (r.status === 200 ? `farmer${i}` : null)).filter(Boolean);
  const prof = await M.Profile.findOne({ user_id: U(winners[0]) }).lean();
  ok(prof.account_status === 'pending' && prof.access_request?.organization, 'a referred farmer waits for the administrator, with the request filled in');
  const early2 = await call(winners[0], 'GET', '/farms');
  ok(early2.status === 403, 'and cannot open any farm data before approval', String(early2.status));
  ok((await M.Notification.countDocuments({ user_id: U('sysadmin'), title: /approve/i })) >= 1, 'the administrators are told');
  const okd = await call('sysadmin', 'PATCH', `/admin/users/${U(winners[0])}`, { account_status: 'active' });
  ok(okd.status === 200, 'the administrator approves the account', String(okd.status));
  ok((await call(winners[0], 'GET', '/farms')).status === 200, 'after approval the farmer can open farm data');
  const notes = await M.Notification.find({ title: /limit/i, user_id: U('orgA') }).lean();
  ok(notes.length >= 2, 'the organization admin is told at 80 and 100 percent of the limit', String(notes.length));

  console.log('5. Farmer list and dashboard');
  const farmers = await call('orgA', 'GET', `/organizations/${orgA}/farmers`);
  ok(farmers.data.total === 2, 'the organization sees its two farmers');
  const dash = await call('orgA', 'GET', `/organizations/${orgA}/dashboard?fresh=1`);
  ok(dash.status === 200 && dash.data.overview.farmers === 2 && dash.data.overview.usage.max === 2, 'the dashboard counts two farmers against a limit of 2');
  const dashB = await call('orgB', 'GET', `/organizations/${orgB}/dashboard?fresh=1`);
  ok(dashB.data.overview.farmers === 0, 'the other organization sees none of them');
  const csv = await fetch(`${BASE}/organizations/${orgA}/farmers?format=csv`, { headers: { 'x-dev-user': U('orgA') } });
  ok(csv.status === 200 && (await csv.text()).includes('Name,Location'), 'the farmer list exports to CSV');
  const lB = (await call('orgB', 'POST', `/organizations/${orgB}/referral-links`, {})).data;
  const other = await call(winners[0], 'POST', `/join/${tokenOf(lB.url)}`, { consent: true });
  ok(other.status === 409 && other.code === 'other_org', 'a farmer in one organization cannot join another');
  const again = await call(winners[0], 'POST', `/join/${tokenOf((await mk()).url)}`, { consent: true });
  ok(again.code === 'already_member' || again.code === 'org_limit', 'joining the same organization twice is refused', again.code);

  console.log('5b. Dashboard with crop data');
  const lSeed = (await call('orgB', 'POST', `/organizations/${orgB}/referral-links`, {})).data;
  await call('seedfarmer', 'GET', '/profile');
  await seedUser(U('seedfarmer'));
  const sj = await call('seedfarmer', 'POST', `/join/${tokenOf(lSeed.url)}`, { consent: true });
  ok(sj.status === 200, 'a farmer with seeded crop data joins organization B');
  const d = (await call('orgB', 'GET', `/organizations/${orgB}/dashboard?fresh=1`)).data;
  ok(d.overview.farmers === 1 && d.overview.active_farmers === 1, 'the farmer counts as active', JSON.stringify(d.overview));
  ok(d.land.farms >= 1 && d.land.total_ha > 0, 'farms and land area are summed', JSON.stringify(d.land).slice(0, 120));
  ok(d.crops.length > 0 && d.crops[0].area_ha > 0 && d.crops[0].farmers === 1, 'crops show area and farmers');
  ok(Object.values(d.stages).some((n) => n > 0), 'cycle stages are counted');
  ok(d.activity.weekly.length === 12 && d.activity.by_type.length > 0, 'activity trend and types are present');
  ok(Array.isArray(d.alerts.reports) && Array.isArray(d.alerts.overdue), 'alert lists are present');
  const list = (await call('orgB', 'GET', `/organizations/${orgB}/farmers`)).data;
  ok(list.total === 1 && list.data[0].farm_ha > 0 && list.data[0].crops.length > 0, 'the farmer list shows farm size and main crops');
  const byCrop = (await call('orgB', 'GET', `/organizations/${orgB}/farmers?crop=${encodeURIComponent(d.crops[0].name)}`)).data;
  ok(byCrop.total === 1, 'the list can be filtered by crop (drill down)');
  const noFin = JSON.stringify(d);
  ok(!/expense|sale|inventory/i.test(noFin), 'no finance or inventory data in the dashboard');
  await clearUser(U('seedfarmer'));

  console.log('6. Leaving and removal');
  const ctx = await call(winners[0], 'GET', '/me/organization');
  ok(ctx.data.farmer_org?.organization?.name === 'Test Cooperative A' && ctx.data.farmer_org.consent_given_at, 'the farmer sees their organization and consent time');
  ok((await call(winners[0], 'POST', '/me/organization/leave')).status === 200, 'a farmer can leave');
  ok((await M.Organization.findById(orgA).lean()).farmer_count === 1, 'the farmer count goes down');
  const dash2 = await call('orgA', 'GET', `/organizations/${orgA}/dashboard?fresh=1`);
  ok(dash2.data.overview.farmers === 1, 'the farmer disappears from the dashboard at once');
  ok((await call('orgA', 'GET', `/organizations/${orgA}/farmers`)).data.total === 1, 'and from the farmer list');
  const staffInvite = await call('orgA', 'POST', `/organizations/${orgA}/members`, { email: 'staff@test.local', role: 'org_staff' });
  ok(staffInvite.status === 201, 'the organization admin invites staff');
  await M.Profile.create({ user_id: U('staff'), email: 'staff@test.local', account_status: 'new' });
  const staffCtx = await call('staff', 'GET', '/profile');
  ok(staffCtx.data.org_context?.membership?.role === 'org_staff', 'invited staff join when they sign in', JSON.stringify(staffCtx.data.org_context));
  ok((await call('staff', 'POST', `/organizations/${orgA}/referral-links`, {})).status === 201, 'staff can create referral links');
  ok((await call('staff', 'GET', `/organizations/${orgA}/farmers`)).status === 200, 'staff can view farmers');
  const staffRemove = await call('staff', 'DELETE', `/organizations/${orgA}/farmers/${U(winners[1])}`);
  ok(staffRemove.status === 403, 'staff cannot remove farmers');
  ok((await call('staff', 'POST', `/organizations/${orgA}/members`, { email: 'x@test.local' })).status === 403, 'staff cannot manage the team');
  ok([403, 404].includes((await call(winners[1], 'GET', `/organizations/${orgA}/farmers`)).status), 'a farmer cannot open organization routes');
  const rm = await call('orgA', 'DELETE', `/organizations/${orgA}/farmers/${U(winners[1])}`);
  ok(rm.status === 200 && (await M.Organization.findById(orgA).lean()).farmer_count === 0, 'the organization admin removes a farmer');

  console.log('7. Lowering the limit and suspension');
  const l4 = (await call('orgA', 'POST', `/organizations/${orgA}/referral-links`, {})).data;
  await call('farmerX', 'POST', `/join/${tokenOf(l4.url)}`, { consent: true });
  await call('sysadmin', 'PATCH', `/admin/organizations/${orgA}`, { max_farmers: 0, reason: 'test lower than count' });
  ok((await M.FarmerOrganization.countDocuments({ organization_id: orgA, status: 'active' })) === 1, 'lowering the limit below the count keeps existing farmers');
  const blocked = await call('farmerY', 'POST', `/join/${tokenOf(l4.url)}`, { consent: true });
  ok(blocked.code === 'org_limit', 'but nobody new can join');
  await call('sysadmin', 'PATCH', `/admin/organizations/${orgA}`, { max_farmers: 5, reason: 'restore' });
  await call('sysadmin', 'PATCH', `/admin/organizations/${orgA}`, { action: 'suspend', reason: 'test' });
  ok((await pub(`/join/${tokenOf(l4.url)}`)).code === 'org_suspended', 'suspension stops its links at once');
  ok((await call('orgA', 'GET', `/organizations/${orgA}/dashboard`)).status === 200, 'a suspended organization can still view data');
  const w = await call('orgA', 'POST', `/organizations/${orgA}/referral-links`, {});
  ok(w.status === 403, 'but cannot change anything');
  ok((await M.Profile.findOne({ user_id: U('farmerX') }).lean()).account_status === 'pending', 'a suspension does not change farmer accounts (this one still waits for approval)');
  await call('sysadmin', 'PATCH', `/admin/organizations/${orgA}`, { action: 'reactivate' });
  ok((await call('orgA', 'POST', `/organizations/${orgA}/referral-links`, {})).status === 201, 'a reactivated organization works again');

  console.log('8. Platform view');
  const stats = await call('sysadmin', 'GET', '/admin/platform-stats');
  ok(stats.status === 200 && stats.data.organizations.active >= 2, 'the system admin sees platform statistics');
  ok((await call('orgA', 'GET', '/admin/organizations')).status === 403, 'organization users cannot open the admin panel');
} finally {
  await cleanup();
  await disconnectDB();
}
console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
