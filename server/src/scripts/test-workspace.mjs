/**
 * Organization workspace and role dashboards:
 *
 *   ALLOW_DEV_AUTH=1 AI_MOCK=1 PORT=5075 node src/index.js      (in one terminal)
 *   node src/scripts/test-workspace.mjs                          (in another)
 *
 * Covers: organization staff inviting farmers, the pending-invitations list (resend, revoke), one farmer's crop records,
 * team roles, the organization activity log, and what each farm account type sees on its home page.
 * Test mode never sends real email. Uses the dev-auth header and removes everything it creates.
 */
import { connectDB } from '../config/db.js';
import * as M from '../models/index.js';

const BASE = process.env.TEST_BASE || 'http://localhost:5075/api';
const P = 'wstest_';
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
const OWNED = [M.Farm, M.Field, M.Crop, M.CropCycle, M.FieldActivity, M.CropScoutingRecord, M.CropProtectionRecord, M.HarvestRecord, M.Expense, M.InventoryItem, M.Equipment, M.EquipmentMaintenance];
const cleanup = async () => {
  const orgs = await M.Organization.find({ created_by: re }, '_id').lean();
  const ids = orgs.map((o) => o._id);
  await Promise.all([
    M.Organization.deleteMany({ _id: { $in: ids } }), M.OrganizationMember.deleteMany({ organization_id: { $in: ids } }),
    M.FarmerInvite.deleteMany({ organization_id: { $in: ids } }), M.FarmerOrganization.deleteMany({ organization_id: { $in: ids } }),
    M.AuditLog.deleteMany({ $or: [{ organization_id: { $in: ids } }, { actor_id: re }] }), M.Notification.deleteMany({ user_id: re }),
    M.Profile.deleteMany({ user_id: re }), ...OWNED.map((Model) => Model.deleteMany({ user_id: re })),
  ]);
};
await cleanup();
const today = new Date().toISOString().slice(0, 10);
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const active = { account_status: 'active', is_active: true, email_verified: true, onboarded: true };

try {
  await M.Profile.create({ user_id: U('sys'), is_admin: true, ...active, email: 'sys@wstest.local' });
  const reg = await call('boss', 'POST', '/organizations/register', { name: 'Workspace Test Cooperative', type: 'Cooperative', country: 'Rwanda', full_name: 'Coop Boss' });
  const org = reg.data.id;
  await call('sys', 'PATCH', `/admin/organizations/${org}`, { action: 'approve', max_farmers: 10, reason: 'test' });
  await M.Profile.create({ user_id: U('staff'), ...active, email: 'staff@wstest.local', user_type: 'org', full_name: 'Staff Person' });
  const staffMember = await M.OrganizationMember.create({ organization_id: org, user_id: U('staff'), role: 'org_staff', status: 'active' });

  console.log('1. organization staff invite farmers');
  const noConsent = await call('staff', 'POST', `/organizations/${org}/farmer-invites`, { emails: 'a@wstest.local' });
  ok(noConsent.status === 400, 'consent must be confirmed first');
  const sent = await call('staff', 'POST', `/organizations/${org}/farmer-invites`, { emails: 'one@wstest.local, two@wstest.local\nnot-an-email', consent_confirmed: true });
  ok(sent.status === 200 && sent.data.invited === 2, 'staff (not only administrators) can invite farmers', JSON.stringify(sent.data));
  const outsider = await call('nobody', 'POST', `/organizations/${org}/farmer-invites`, { emails: 'x@wstest.local', consent_confirmed: true });
  ok([401, 403, 404].includes(outsider.status), 'someone outside the organization cannot', String(outsider.status));
  await M.Profile.create({ user_id: U('f1'), ...active, email: 'existing@wstest.local', full_name: 'Existing Farmer' });
  const existing = await call('staff', 'POST', `/organizations/${org}/farmer-invites`, { emails: 'existing@wstest.local', consent_confirmed: true });
  ok(existing.data?.joined === 1, 'a farmer who already has an account is linked at once', JSON.stringify(existing.data));

  console.log('2. pending invitations');
  const list = await call('staff', 'GET', `/organizations/${org}/farmer-invites`);
  ok(list.status === 200 && list.data.counts.invited === 2, 'two invitations are waiting', JSON.stringify(list.data?.counts));
  const first = list.data.data.find((i) => i.email === 'one@wstest.local');
  const resend = await call('staff', 'POST', `/organizations/${org}/farmer-invites/${first.id}/resend`);
  ok(resend.status === 200 && resend.data.status === 'invited', 'an invitation can be sent again', JSON.stringify(resend.data));
  await M.FarmerInvite.updateOne({ _id: first.id }, { $set: { last_sent_at: new Date() } });
  const tooSoon = await call('staff', 'POST', `/organizations/${org}/farmer-invites/${first.id}/resend`);
  ok(tooSoon.status === 429, 'but not again straight away', String(tooSoon.status));
  const revoked = await call('staff', 'DELETE', `/organizations/${org}/farmer-invites/${first.id}`);
  ok(revoked.status === 200 && revoked.data.status === 'revoked', 'an invitation can be revoked');
  const after = await call('staff', 'GET', `/organizations/${org}/farmer-invites?status=revoked`);
  ok(after.data.data.length === 1 && after.data.data[0].email === 'one@wstest.local', 'the list can be filtered by status');
  await M.FarmerInvite.updateOne({ organization_id: org, email: 'two@wstest.local' }, { $set: { expires_at: new Date(Date.now() - 1000) } });
  const expired = await call('staff', 'GET', `/organizations/${org}/farmer-invites?status=expired`);
  ok(expired.data.data.length === 1, 'an invitation past its date reads as expired');
  const lateResend = await call('staff', 'POST', `/organizations/${org}/farmer-invites/${expired.data.data[0].id}/resend`);
  ok(lateResend.status === 200 && lateResend.data.status === 'invited', 'and an expired one can be sent again');

  console.log('3. one farmer\'s crop records');
  const farm = await M.Farm.create({ user_id: U('f1'), name: 'Hill Farm', district: 'Musanze', total_area: 2, area_unit: 'hectares' });
  const crop = await M.Crop.create({ user_id: U('f1'), name: 'Maize', category: 'Cereal' });
  const field = await M.Field.create({ user_id: U('f1'), farm_id: farm._id, name: 'Upper', area: 1, area_unit: 'hectares' });
  await M.CropCycle.create({ user_id: U('f1'), farm_id: farm._id, field_id: field._id, crop_id: crop._id, status: 'Growing', planting_date: day(-40), expected_harvest_date: day(30), area_planted: 1 });
  await M.FieldActivity.create({ user_id: U('f1'), activity_type: 'Weeding', activity_date: day(-2), description: 'First weeding' });
  await M.CropScoutingRecord.create({ user_id: U('f1'), scouting_date: day(-1), disease_observation: 'Grey leaf spot', plant_health: 'Fair' });
  await M.HarvestRecord.create({ user_id: U('f1'), crop_id: crop._id, harvest_date: day(-100), quantity: 2, unit: 'tonnes' });
  await M.Expense.create({ user_id: U('f1'), category: 'Seed', amount: 999, expense_date: today });
  const rec = await call('staff', 'GET', `/organizations/${org}/farmers/${U('f1')}/records`);
  ok(rec.status === 200 && rec.data.farmer.name === 'Existing Farmer', 'staff can open a linked farmer\'s records', JSON.stringify(rec.data).slice(0, 120));
  ok(rec.data.cycles[0]?.crop === 'Maize' && rec.data.farms[0]?.name === 'Hill Farm', 'farms and crops are listed');
  ok(rec.data.scouting[0]?.disease === 'Grey leaf spot' && rec.data.activities[0]?.type === 'Weeding', 'scouting and work are listed');
  ok(rec.data.harvested_kg[0]?.kg === 2000, 'harvest is added up in kg', JSON.stringify(rec.data.harvested_kg));
  ok(!JSON.stringify(rec.data).includes('999') && !('expenses' in rec.data), 'money is never part of it');
  await M.Profile.create({ user_id: U('f2'), ...active, email: 'other@wstest.local' });
  const notMine = await call('staff', 'GET', `/organizations/${org}/farmers/${U('f2')}/records`);
  ok(notMine.status === 404, 'a farmer who is not in the organization cannot be opened');
  const notInOrg = await call('nobody', 'GET', `/organizations/${org}/farmers/${U('f1')}/records`);
  ok([401, 403, 404].includes(notInOrg.status), 'and outsiders cannot open anyone', String(notInOrg.status));

  console.log('4. team roles and activity');
  const denied = await call('staff', 'PATCH', `/organizations/${org}/members/${staffMember._id}`, { role: 'org_admin' });
  ok(denied.status === 403, 'staff cannot make themselves administrator', String(denied.status));
  const promote = await call('boss', 'PATCH', `/organizations/${org}/members/${staffMember._id}`, { role: 'org_admin' });
  ok(promote.status === 200 && promote.data.role === 'org_admin', 'an administrator can change a role');
  const bossMember = await M.OrganizationMember.findOne({ organization_id: org, user_id: U('boss') });
  const demote = await call('staff', 'PATCH', `/organizations/${org}/members/${bossMember._id}`, { role: 'org_staff' });
  ok(demote.status === 200, 'with two administrators one can step down');
  const last = await call('boss', 'PATCH', `/organizations/${org}/members/${staffMember._id}`, { role: 'org_staff' });
  ok(last.status === 403 || last.status === 400, 'the last administrator cannot be demoted', String(last.status));
  const bad = await call('staff', 'PATCH', `/organizations/${org}/members/${bossMember._id}`, { role: 'owner' });
  ok(bad.status === 400, 'an unknown role is refused');
  const log = await call('staff', 'GET', `/organizations/${org}/activity`);
  ok(log.status === 200 && log.data.data.some((a) => a.action === 'member.role_changed') && log.data.data.some((a) => a.action === 'farmers.invited'), 'the activity log shows what happened');
  await M.OrganizationMember.updateOne({ _id: staffMember._id }, { $set: { role: 'org_staff' } });
  await M.OrganizationMember.updateOne({ _id: bossMember._id }, { $set: { role: 'org_admin' } });
  ok((await call('staff', 'GET', `/organizations/${org}/activity`)).status === 403, 'staff cannot read the activity log');

  console.log('5. each account type sees its own home page');
  const make = async (name, role) => { await M.Profile.create({ user_id: U(name), ...active, email: `${name}@wstest.local`, role }); };
  await make('farmer', 'Farmer'); await make('manager', 'Farm Manager'); await make('agro', 'Agronomist'); await make('coop', 'Cooperative Manager');
  for (const who of ['farmer', 'manager', 'agro']) {
    const cropX = await M.Crop.create({ user_id: U(who), name: 'Beans', category: 'Legume' });
    const farmX = await M.Farm.create({ user_id: U(who), name: `${who} farm`, total_area: 1 });
    const fieldX = await M.Field.create({ user_id: U(who), farm_id: farmX._id, name: 'F', area: 1 });
    await M.CropCycle.create({ user_id: U(who), farm_id: farmX._id, field_id: fieldX._id, crop_id: cropX._id, status: 'Growing', expected_harvest_date: day(-5), area_planted: 1 });
    await M.CropCycle.create({ user_id: U(who), farm_id: farmX._id, field_id: fieldX._id, crop_id: cropX._id, status: 'Growing', expected_harvest_date: day(7), area_planted: 1 });
    await M.InventoryItem.create({ user_id: U(who), name: 'Urea', category: 'Fertilizer', current_quantity: 1, minimum_stock: 5 });
    await M.CropProtectionRecord.create({ user_id: U(who), protection_date: day(-3), problem_type: 'Pest', problem_name: 'Fall armyworm', severity: 'High' });
    await M.CropScoutingRecord.create({ user_id: U(who), scouting_date: day(-2), pest_observation: 'Armyworm holes', plant_health: 'Poor' });
  }
  const eq = await M.Equipment.create({ user_id: U('manager'), name: 'Tractor', category: 'Tractor' });
  await M.EquipmentMaintenance.create({ user_id: U('manager'), equipment_id: eq._id, maintenance_date: day(-60), next_maintenance: day(-1) });
  await M.Expense.create({ user_id: U('manager'), category: 'Fuel', amount: 120, expense_date: today });

  const f = (await call('farmer', 'GET', '/dashboard/role')).data;
  ok(f.role === 'Farmer' && f.operations.overdue_count === 1 && f.operations.harvest_soon_count === 1 && f.operations.low_stock_count === 1 && !f.crop_health && !f.organization, 'a farmer sees what needs attention on the farm', JSON.stringify(f).slice(0, 160));
  const m = (await call('manager', 'GET', '/dashboard/role')).data;
  ok(m.role === 'Farm Manager' && m.operations.maintenance_due_count === 1 && m.operations.maintenance_due[0].overdue === true && m.operations.spending.this_month === 120, 'a farm manager also sees machines due for service and spending', JSON.stringify(m.operations).slice(0, 200));
  const a = (await call('agro', 'GET', '/dashboard/role')).data;
  ok(a.role === 'Agronomist' && a.crop_health.problems_count === 1 && a.crop_health.serious_count === 1 && a.crop_health.needs_visit_count >= 0, 'an agronomist sees crop health first', JSON.stringify(a.crop_health).slice(0, 200));
  ok(a.crop_health.problems_found[0].kind === 'Pest' && a.crop_health.serious_issues[0].name === 'Fall armyworm', 'with the problems found and the serious cases');
  const c = (await call('coop', 'GET', '/dashboard/role')).data;
  ok(c.role === 'Cooperative Manager' && c.organization && c.organization.has_workspace === false && c.organization.register_path, 'a cooperative manager is pointed to the organization tools', JSON.stringify(c).slice(0, 160));
  const other = (await call('farmer', 'GET', '/dashboard/role')).data;
  ok(other.operations.low_stock[0].name === 'Urea', 'each person sees only their own records');
} finally {
  await cleanup();
  console.log(`\n${passed} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}
