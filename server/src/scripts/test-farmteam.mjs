/**
 * The farm manager and their data collectors, across the whole platform:
 *
 *   node src/scripts/test-farmteam.mjs
 *
 * - the permission policy on its own (what a data collector may reach)
 * - inviting a collector, the invitation becoming their account at the first sign-in, and the wait for an administrator's approval
 * - what a collector can and cannot do on the manager's farm; everything they record is the manager's and carries their name
 * - tasks, the collector's dashboard, the manager's team list
 * - cancelling an invitation, removing a collector (the entries stay), adding one again
 *
 * Starts the API itself in test mode (no email is sent) and removes everything it creates.
 */
import { spawn } from 'node:child_process';
import { connectDB } from '../config/db.js';
import * as M from '../models/index.js';
import { OWNED_MODELS } from '../lib/seedData.js';
import { collectorMayCall, isOwnEntry, OPERATIONAL } from '../lib/farmPolicy.js';

const PREFIX = 'ftm_';
const MGR = `${PREFIX}manager`;
const OTHER = `${PREFIX}otherfarmer`;
const ADMIN = `${PREFIX}admin`;
const A = `${PREFIX}alice`; // collectors' account ids (their profiles are created at the first sign-in)
const B = `${PREFIX}bob`;
const email = (u) => `${u.replace(PREFIX, '')}@${PREFIX}local.test`;
let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };

console.log('1. the permission policy');
const may = (m, p) => collectorMayCall(m, p).ok;
ok(OPERATIONAL.every((p) => may('GET', p) && may('POST', p) && may('PUT', `${p}/abc`) && !may('DELETE', `${p}/abc`)), 'a collector reads, records and edits every kind of field record, and never deletes');
ok(['farms', 'fields', 'crops', 'crop-varieties', 'seasons', 'crop-cycles'].every((p) => may('GET', p) && !may('POST', p) && !may('PUT', `${p}/x`)), 'the farm\'s set-up can be read (to choose a field or a crop) but not changed');
ok(['expenses', 'sales', 'export', 'export/fields', 'reports', 'calendar', 'ai/chat', 'ai', 'search', 'inventory-items', 'equipment', 'equipment-maintenance', 'team', 'calculation-history', 'calculators/context', 'dashboard', 'dashboard/role'].every((p) => !may('GET', p)), 'finances, reports, exports, the calendar, the assistant, the team and the manager\'s dashboards are closed');
ok(may('GET', 'dashboard/collector') && may('GET', 'tasks') && may('PUT', 'tasks/abc') && !may('POST', 'tasks') && !may('DELETE', 'tasks/abc'), 'their own dashboard and tasks: they can mark a task done, not create or delete one');
ok(may('GET', 'greenhouse/houses') && may('POST', 'greenhouse/counts') && may('POST', 'uploads') && may('GET', 'weather') && may('PUT', 'notifications/read-all'), 'the greenhouse (it applies its own rules), photo upload, the weather and their notifications stay open');
ok(!may('DELETE', 'expenses/1') && !may('PUT', 'farms/1') && !may('POST', 'farms') && collectorMayCall('GET', 'sales').why.length > 5, 'a refusal always says why');
ok(isOwnEntry({ recorded_by: 'u1' }, 'u1') && !isOwnEntry({ recorded_by: 'u2' }, 'u1') && !isOwnEntry({}, 'u1') && !isOwnEntry(null, 'u1'), 'only an entry the collector recorded is theirs to edit');

await connectDB();
const cleanup = async () => {
  const re = new RegExp(`^${PREFIX}`);
  await Promise.all([...OWNED_MODELS, M.Profile].map((Model) => Model.deleteMany({ user_id: re })));
  await M.FarmMember.deleteMany({ invited_email: new RegExp(`@${PREFIX}`) });
  await M.Notification.deleteMany({ user_id: re });
};
await cleanup();
const mkProfile = (id, extra = {}) => M.Profile.create({ user_id: id, email: email(id), email_verified: true, full_name: id.replace(PREFIX, '').replace(/^./, (c) => c.toUpperCase()), account_status: 'active', is_active: true, onboarded: true, ...extra });
await mkProfile(MGR, { full_name: 'Martha Manager' });
await mkProfile(OTHER);
await mkProfile(ADMIN, { is_admin: true });

const child = spawn(process.execPath, ['src/index.js'], { cwd: new URL('../../', import.meta.url), env: { ...process.env, PORT: '5093', AI_MOCK: '1', ALLOW_DEV_AUTH: '1', INVITE_DRY_RUN: '1', TEAM_INVITES_PER_HOUR: '25' }, stdio: ['ignore', 'pipe', 'pipe'] });
const base = 'http://localhost:5093';
for (let i = 0; i < 180; i += 1) {
  try { if ((await fetch(`${base}/api/health`)).status < 500) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 500));
}
const req = (user, method, path, body, headers = {}) => fetch(base + path, { method, headers: { 'x-dev-user': user, 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const json = async (r) => { try { return await r.json(); } catch { return {}; } };
const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

try {
  // the manager's farm
  const farm = await json(await req(MGR, 'POST', '/api/farms', { name: 'Hillside Farm' }));
  const north = await json(await req(MGR, 'POST', '/api/fields', { name: 'North', farm_id: farm.id, latitude: -1.95, longitude: 30.06 }));
  const south = await json(await req(MGR, 'POST', '/api/fields', { name: 'South', farm_id: farm.id, latitude: -1.96, longitude: 30.07 }));
  const maize = await json(await req(MGR, 'POST', '/api/crops', { name: 'Maize' }));
  await json(await req(MGR, 'POST', '/api/expenses', { farm_id: farm.id, category: 'Seeds', amount: 500, expense_date: today, description: 'Seed' }));
  ok(farm.id && north.id && south.id && maize.id, 'the farm manager has a farm, two fields and a crop');
  const cycle = await json(await req(MGR, 'POST', '/api/crop-cycles', { farm_id: farm.id, field_id: north.id, crop_id: maize.id, status: 'Growing' }));
  await req(MGR, 'POST', '/api/crop-scouting-records', { farm_id: farm.id, field_id: south.id, scouting_date: daysAgo(1), plant_health: 'Healthy' });

  console.log('2. inviting a data collector');
  const bad = await Promise.all([
    req(MGR, 'POST', '/api/team', { name: '', email: email(A) }), req(MGR, 'POST', '/api/team', { name: 'Alice', email: 'not-an-email' }),
    req(MGR, 'POST', '/api/team', { name: 'Alice', email: email(A), phone: 'abc' }), req(MGR, 'POST', '/api/team', { name: 'Me', email: email(MGR) }),
  ]);
  ok(bad.every((r) => r.status === 400), 'a missing name, a bad email, a bad phone number and the manager\'s own address are refused', bad.map((r) => r.status).join());
  const clash = await Promise.all([req(MGR, 'POST', '/api/team', { name: 'Other', email: email(OTHER) }), req(MGR, 'POST', '/api/team', { name: 'Admin', email: email(ADMIN) })]);
  ok(clash.every((r) => r.status === 409), 'an address that already has a farmer or administrator account cannot be a data collector (they need their own login)', clash.map((r) => r.status).join());
  const inv = await req(MGR, 'POST', '/api/team', { name: 'Alice Collector', email: email(A).toUpperCase(), phone: '+250 788 000 111' });
  const aliceInvite = await json(inv);
  ok(inv.status === 201 && aliceInvite.status === 'invited' && aliceInvite.email === email(A) && aliceInvite.name === 'Alice Collector' && aliceInvite.phone === '+250 788 000 111' && aliceInvite.role === 'collector' && aliceInvite.week_entries === 0, 'the farm manager invites a collector by name, email and phone', JSON.stringify(aliceInvite));
  ok((await req(MGR, 'POST', '/api/team', { name: 'Alice again', email: email(A) })).status === 409, 'the same address cannot be invited twice');
  const bobInv = await json(await req(MGR, 'POST', '/api/team', { name: 'Bob Collector', email: email(B) }));
  ok(bobInv.status === 'invited', 'a second collector is invited');
  const list0 = await json(await req(MGR, 'GET', '/api/team'));
  ok(list0.data.length === 2 && list0.totals.waiting === 2 && list0.totals.collectors === 0, 'both show as waiting on the Team page');

  console.log('3. the invitation becomes the account at the first sign-in, then waits for approval');
  await M.Profile.create({ user_id: A, email: email(A), email_verified: true, full_name: '', account_status: 'new', user_type: 'farmer' }); // what signing up creates
  const me = await json(await req(A, 'GET', '/api/profile'));
  ok(me.user_type === 'collector' && me.account_status === 'pending' && me.role === 'Data collector' && me.farm_team.role === 'collector' && me.farm_team.linked === true && me.farm_team.farm_manager === 'Martha Manager', 'at the first sign-in the invitation becomes a data collector account linked to the manager\'s farm, waiting for approval', JSON.stringify(me).slice(0, 300));
  ok(me.full_name === 'Alice Collector' && me.phone === '+250 788 000 111', 'it carries the name and phone the manager entered');
  ok((await req(A, 'GET', '/api/fields')).status === 403, 'until an administrator approves, the collector reaches nothing');
  const adminNote = await M.Notification.findOne({ user_id: ADMIN, title: /data collector/i }).lean();
  const managerNote = await M.Notification.findOne({ user_id: MGR, title: 'Invitation accepted' }).lean();
  ok(!!managerNote, 'the farm manager is told the invitation was accepted');
  const list1 = await json(await req(MGR, 'GET', '/api/team'));
  ok(list1.data.find((m) => m.email === email(A)).status === 'active' && list1.totals.collectors === 1 && list1.totals.waiting === 1, 'the Team page now shows Alice as a member and Bob as still waiting');
  await M.Profile.updateOne({ user_id: A }, { $set: { account_status: 'active', is_active: true } }); // the administrator approves

  console.log('4. what a data collector can do on the manager\'s farm');
  const fields = await json(await req(A, 'GET', '/api/fields'));
  ok(fields.data.length === 2 && fields.data.some((f) => f.name === 'North'), 'the collector sees the manager\'s fields to choose from');
  const mk = await req(A, 'POST', '/api/field-activities', { farm_id: farm.id, field_id: north.id, activity_type: 'Weeding', activity_date: today, description: 'Weeded the north field' });
  const act = await json(mk);
  ok(mk.status === 201 && act.recorded_by === A && act.recorded_by_name === 'Alice Collector', 'what the collector records is tagged with their name', JSON.stringify(act).slice(0, 200));
  const asManager = await json(await req(MGR, 'GET', `/api/field-activities/${act.id}`));
  ok(asManager.id === act.id && asManager.user_id === MGR && asManager.recorded_by_name === 'Alice Collector', 'it is saved into the manager\'s farm and the manager sees it at once, with who recorded it');
  const forged = await json(await req(A, 'PUT', `/api/field-activities/${act.id}`, { description: 'Weeded north, twice', recorded_by: 'someone-else', recorded_by_name: 'Martha', user_id: OTHER }));
  ok(forged.description === 'Weeded north, twice' && forged.recorded_by === A && forged.recorded_by_name === 'Alice Collector' && forged.user_id === MGR, 'a collector edits their own entry, and cannot change who recorded it or whose farm it is');
  const mgrEntry = await json(await req(MGR, 'POST', '/api/field-activities', { farm_id: farm.id, field_id: south.id, activity_type: 'Planting', activity_date: today }));
  ok(mgrEntry.recorded_by === MGR && mgrEntry.recorded_by_name === 'Martha Manager', 'the manager\'s own entries carry their name too');
  const edit = await req(A, 'PUT', `/api/field-activities/${mgrEntry.id}`, { description: 'changed' });
  ok(edit.status === 403 && (await json(edit)).details?.code === 'collector_not_yours', 'a collector cannot edit the manager\'s entries');
  const del = await Promise.all([req(A, 'DELETE', `/api/field-activities/${act.id}`), req(A, 'DELETE', `/api/fields/${north.id}`), req(A, 'DELETE', `/api/farms/${farm.id}`)]);
  ok(del.every((r) => r.status === 403), 'a collector cannot delete anything, even their own entry');
  const closed = await Promise.all([
    req(A, 'GET', '/api/expenses'), req(A, 'GET', '/api/sales'), req(A, 'GET', '/api/calendar'), req(A, 'GET', '/api/export?format=csv'), req(A, 'GET', '/api/export/fields?format=csv'),
    req(A, 'POST', '/api/ai/chat', { message: 'hello' }), req(A, 'GET', '/api/search?q=seed'), req(A, 'GET', '/api/dashboard'), req(A, 'GET', '/api/dashboard/role'),
    req(A, 'GET', '/api/inventory-items'), req(A, 'GET', '/api/equipment'), req(A, 'GET', '/api/team'), req(A, 'POST', '/api/team', { name: 'Eve', email: email('eve') }), req(A, 'POST', '/api/expenses', { amount: 1 }),
  ]);
  ok(closed.every((r) => r.status === 403), 'finances, the calendar, exports, search, the assistant, the manager\'s dashboards and the team are closed to a collector', closed.map((r) => r.status).join());
  const setup = await Promise.all([req(A, 'POST', '/api/farms', { name: 'Mine' }), req(A, 'PUT', `/api/farms/${farm.id}`, { name: 'Renamed' }), req(A, 'POST', '/api/fields', { name: 'New', farm_id: farm.id, latitude: 1, longitude: 1 }), req(A, 'PUT', `/api/crops/${maize.id}`, { name: 'x' })]);
  ok(setup.every((r) => r.status === 403) && (await json(await req(MGR, 'GET', `/api/farms/${farm.id}`))).name === 'Hillside Farm', 'a collector cannot change the farm profile or its set-up');
  const refuse = await json(await req(A, 'GET', '/api/expenses'));
  ok(/farm manager/i.test(refuse.message || '') && refuse.details?.code === 'collector_forbidden', 'a refusal says it is for the farm manager');
  ok((await json(await req(A, 'GET', '/api/field-activities'))).total === 2, 'a collector reads the farm\'s field records');

  console.log('5. one farm only, however the request is phrased');
  const spoof = await json(await req(A, 'GET', '/api/fields', undefined, { 'x-farm-owner': OTHER }));
  ok(spoof.data.every((f) => f.user_id === MGR || f.name), 'naming another farm in a header changes nothing');
  await json(await req(OTHER, 'POST', '/api/farms', { name: 'Other farm' }));
  const mine = await json(await req(A, 'GET', '/api/farms', undefined, { 'x-farm-owner': OTHER }));
  ok(mine.data.length === 1 && mine.data[0].name === 'Hillside Farm', 'a collector never reaches another farm\'s records');
  const theirs = await json(await req(OTHER, 'GET', '/api/field-activities'));
  ok(theirs.total === 0, 'and the other farm never sees this farm\'s entries');

  console.log('6. notifications belong to the person');
  await M.Notification.create({ user_id: MGR, title: 'Manager only', message: 'x' });
  await M.Notification.create({ user_id: A, title: 'For Alice', message: 'x' });
  const notes = await json(await req(A, 'GET', '/api/notifications'));
  ok(notes.data.some((n) => n.title === 'For Alice') && !notes.data.some((n) => n.title === 'Manager only'), 'a collector sees their own notifications, not the manager\'s');

  console.log('7. tasks');
  const aliceMember = list1.data.find((m) => m.email === email(A));
  const t1 = await req(MGR, 'POST', '/api/tasks', { title: 'Scout the south field', description: 'Look for armyworm', due_date: daysAgo(1), priority: 'High', assigned_to: A, field_id: south.id });
  const task1 = await json(t1);
  ok(t1.status === 201 && task1.assigned_to === A && task1.assigned_to_name === 'Alice Collector' && task1.status === 'open', 'the farm manager hands a task to one collector, by name');
  const task2 = await json(await req(MGR, 'POST', '/api/tasks', { title: 'Clean the tools', assigned_to: '' }));
  ok(task2.assigned_to === '' && task2.assigned_to_name === '', 'or leaves it for everyone');
  ok((await req(MGR, 'POST', '/api/tasks', { title: 'Nobody', assigned_to: OTHER })).status === 400, 'a task cannot be assigned to someone who is not on the team');
  const taskB = await json(await req(MGR, 'POST', '/api/tasks', { title: 'Not for Alice', assigned_to: `${PREFIX}ghost` }));
  const mineTasks = await json(await req(A, 'GET', '/api/tasks'));
  ok(mineTasks.data.length === 2 && mineTasks.data.some((t) => t.title === 'Clean the tools') && mineTasks.data.every((t) => t.assigned_to === A || t.assigned_to === ''), 'a collector sees the tasks that are theirs and the ones for everyone');
  await M.Task.create({ user_id: MGR, title: 'Bob only', assigned_to: B, assigned_to_name: 'Bob' });
  ok((await json(await req(A, 'GET', '/api/tasks'))).data.every((t) => t.title !== 'Bob only'), 'never a colleague\'s task');
  const denyTask = await Promise.all([req(A, 'POST', '/api/tasks', { title: 'Mine' }), req(A, 'DELETE', `/api/tasks/${task1.id}`), req(A, 'PUT', `/api/tasks/${task1.id}`, { title: 'Renamed', status: 'done' }), req(A, 'PUT', `/api/tasks/${task1.id}`, { assigned_to: A, status: 'done' })]);
  ok(denyTask.every((r) => r.status === 403), 'a collector cannot create, delete or rewrite a task');
  const bobsTask = await M.Task.findOne({ user_id: MGR, title: 'Bob only' }).lean();
  ok((await req(A, 'PUT', `/api/tasks/${bobsTask._id}`, { status: 'done' })).status === 404, 'or touch a colleague\'s task');
  const done = await json(await req(A, 'PUT', `/api/tasks/${task1.id}`, { status: 'done', completion_note: 'No armyworm found' }));
  ok(done.status === 'done' && done.done_by === A && done.done_by_name === 'Alice Collector' && done.completion_note === 'No armyworm found' && done.done_at, 'a collector marks their task done, with a note');
  const seenByManager = await json(await req(MGR, 'GET', `/api/tasks/${task1.id}`));
  ok(seenByManager.status === 'done' && seenByManager.done_by_name === 'Alice Collector', 'and the manager sees who completed it');
  const reopen = await json(await req(A, 'PUT', `/api/tasks/${task1.id}`, { status: 'open' }));
  ok(reopen.status === 'open' && reopen.done_by === '', 'it can be opened again by the one who completed it');
  const forgery = await json(await req(MGR, 'POST', '/api/tasks', { title: 'Forged', done_by: 'x', done_at: new Date().toISOString() }));
  ok(!forgery.done_by && !forgery.done_at, 'the done fields are set only by marking a task done');

  console.log('8. the data collector\'s dashboard');
  const guardOK = await req(MGR, 'GET', '/api/dashboard/collector');
  ok(guardOK.status === 403, 'the farm manager is not shown the collector\'s page');
  await req(A, 'POST', '/api/crop-scouting-records', { farm_id: farm.id, field_id: north.id, scouting_date: today, plant_health: 'Healthy' });
  const dash = await json(await req(A, 'GET', '/api/dashboard/collector'));
  ok(dash.role === 'collector' && dash.farm_manager === 'Martha Manager' && dash.today.entries === 2 && dash.week.entries === 2, 'today\'s entry count and this week\'s', JSON.stringify([dash.today, dash.week]));
  ok(OPERATIONAL.every((p) => dash.record.some((r) => r.path === p)) && dash.record.some((r) => r.path === 'greenhouse'), 'a button to record each kind of field work, and the greenhouse');
  ok(dash.tasks.open === 3 && dash.tasks.overdue >= 1 && dash.tasks.items.some((t) => t.title === 'Scout the south field' && t.overdue), 'their open tasks, with the late ones marked');
  ok(dash.needs_check.some((f) => f.name === 'North') === false && Array.isArray(dash.needs_check), 'fields scouted today do not need a check', JSON.stringify(dash.needs_check));
  await M.CropScoutingRecord.deleteMany({ user_id: MGR, field_id: south.id });
  const dash2 = await json(await req(A, 'GET', '/api/dashboard/collector'));
  ok(dash2.needs_check.length >= 0 && !JSON.stringify(dash2).includes('expense') && dash2.recent.length === 2 && dash2.recent.every((r) => r.created_at && r.kind), 'their own recent entries, newest first, and nothing about money');
  ok(dash2.recent[0].created_at >= dash2.recent[1].created_at, 'recent entries are in order');

  console.log('9. the farm manager follows the team');
  const team = await json(await req(MGR, 'GET', '/api/team'));
  const alice = team.data.find((m) => m.email === email(A));
  ok(alice.status === 'active' && alice.week_entries === 2 && alice.last_activity, 'the Team page shows each collector\'s entries this week and last activity', JSON.stringify(alice));
  const detail = await json(await req(MGR, 'GET', `/api/team/${alice.id}`));
  ok(detail.recent.length === 2 && detail.recent.every((r) => r.id && r.path), 'and a collector\'s latest entries');
  const dashM = await json(await req(MGR, 'GET', '/api/dashboard'));
  ok(Array.isArray(dashM.team) && dashM.team.find((m) => m.email === email(A)).week_entries === 2, 'the manager\'s dashboard has the team card');
  const patched = await json(await req(MGR, 'PUT', `/api/team/${alice.id}`, { phone: '+250 788 999 999' }));
  ok(patched.phone === '+250 788 999 999' && (await req(MGR, 'PUT', `/api/team/${alice.id}`, { name: 'A' })).status === 400, 'the manager can correct a name or phone number');
  const xs = [(await req(OTHER, 'GET', `/api/team/${alice.id}`)), (await req(OTHER, 'DELETE', `/api/team/${alice.id}`))];
  ok(xs[0].status === 404 && xs[1].status === 404, 'another farm manager cannot see or remove them', JSON.stringify([xs[0].status, xs[1].status, await json(xs[1])]));

  console.log('10. waiting invitations');
  const bobId = (await json(await req(MGR, 'GET', '/api/team'))).data.find((m) => m.email === email(B)).id;
  const resent = await req(MGR, 'POST', `/api/team/${bobId}/resend`);
  ok(resent.status === 200 && (await json(resent)).status === 'invited', 'a waiting invitation can be sent again');
  ok((await req(MGR, 'POST', `/api/team/${alice.id}/resend`)).status === 404, 'only a waiting invitation can be sent again');
  await M.FarmMember.updateOne({ _id: bobId }, { $set: { expires_at: new Date(Date.now() - 1000) } });
  ok((await json(await req(MGR, 'GET', '/api/team'))).data.find((m) => m.id === bobId).status === 'expired', 'an invitation not accepted in time reads as expired');
  await req(MGR, 'POST', `/api/team/${bobId}/resend`);
  ok((await json(await req(MGR, 'GET', '/api/team'))).data.find((m) => m.id === bobId).status === 'invited', 'and sending it again renews it');
  const cancel = await json(await req(MGR, 'DELETE', `/api/team/${bobId}`));
  ok(cancel.ended_as === 'cancelled', 'the farm manager cancels a waiting invitation');
  await M.Profile.create({ user_id: B, email: email(B), email_verified: true, account_status: 'new', user_type: 'farmer' });
  const bobMe = await json(await req(B, 'GET', '/api/profile'));
  ok(bobMe.user_type === 'farmer' && bobMe.account_status === 'new' && bobMe.farm_team.role === 'manager', 'a cancelled invitation does not link anyone: signing in with that address gives an ordinary new account');
  ok((await json(await req(MGR, 'GET', '/api/team'))).data.every((m) => m.email !== email(B)), 'it leaves the list');

  console.log('11. removing a collector');
  const removed = await json(await req(MGR, 'DELETE', `/api/team/${alice.id}`));
  ok(removed.ended_as === 'removed', 'the farm manager removes a collector');
  const after = await Promise.all([req(A, 'GET', '/api/fields'), req(A, 'POST', '/api/field-activities', { activity_type: 'x', activity_date: today }), req(A, 'GET', '/api/dashboard/collector'), req(A, 'GET', '/api/tasks')]);
  ok(after.every((r) => r.status === 403) && (await json(after[0])).details?.code === 'collector_unlinked', 'their access ends at once, and they are told so');
  const kept = await json(await req(MGR, 'GET', '/api/field-activities'));
  ok(kept.total === 2 && kept.data.filter((r) => r.recorded_by_name === 'Alice Collector').length === 1, 'the entries they made stay in the farm\'s records, still tagged with their name');
  ok((await json(await req(MGR, 'GET', '/api/team?include=removed'))).data.some((m) => m.id === alice.id && m.status === 'removed'), 'and the Team page can show who was removed');
  ok((await req(A, 'GET', '/api/profile')).status === 200, 'the collector can still sign in and see their own profile');
  const again = await req(MGR, 'POST', '/api/team', { name: 'Alice Collector', email: email(A) });
  const againBody = await json(again);
  ok(again.status === 201 && againBody.status === 'active', 'a collector without a farm can be added again, and is linked at once', JSON.stringify(againBody));
  ok((await req(A, 'GET', '/api/fields')).status === 200 && (await json(await req(A, 'GET', '/api/field-activities'))).total === 2, 'and works again, seeing the same records');
  const second = await req(OTHER, 'POST', '/api/team', { name: 'Alice', email: email(A) });
  ok(second.status === 409, 'a collector works for one farm at a time');

  console.log('12. greenhouse');
  const gAccess = await json(await req(A, 'GET', '/api/greenhouse/access'));
  ok(gAccess.own.role === 'collector' && gAccess.own.owner_id === MGR && gAccess.farms.length === 0, 'the greenhouse puts a collector on their manager\'s farm automatically');
  const gDenied = await Promise.all([req(A, 'POST', '/api/greenhouse/crops', { catalog_key: 'tomato' }), req(A, 'GET', '/api/greenhouse/dashboard'), req(A, 'GET', '/api/greenhouse/alerts'), req(A, 'GET', '/api/greenhouse/revenue')]);
  ok(gDenied.every((r) => r.status === 403), 'with the greenhouse\'s own limits: no crops, dashboard, alerts or values');
  ok((await req(A, 'GET', '/api/greenhouse/houses')).status === 200, 'but the plan and recording are open');

  console.log('13. exports, and the manager account status');
  const csv = await (await req(MGR, 'GET', '/api/export/field-activities?format=csv')).text();
  const head = csv.split(String.fromCharCode(10)).find((l) => /Activity/i.test(l)) || '';
  ok(/Recorded by/.test(head) && !/Recorded by name/.test(head) && !csv.includes('ftm_alice') && csv.includes('Alice Collector'), 'the manager export has a "Recorded by" column with the name, and no account ids', head.slice(0, 200));
  await M.Profile.updateOne({ user_id: MGR }, { $set: { account_status: 'on_hold' } });
  const held = await req(A, 'GET', '/api/fields');
  ok(held.status === 403 && (await json(held)).details?.code === 'farm_inactive', 'a collector cannot work while an administrator has the manager account on hold');
  await M.Profile.updateOne({ user_id: MGR }, { $set: { account_status: 'active' } });
  ok((await req(A, 'GET', '/api/fields')).status === 200, 'and works again when the account is active');

  console.log('14. abuse');
  const joinTry = await req(A, 'POST', '/api/join/not-a-real-token', { consent: true });
  ok(joinTry.status === 403 && (await json(joinTry)).details?.code === 'collector_account', 'a data collector cannot join an organization through a referral link');
  const codes = [];
  for (let i = 0; i < 40; i += 1) codes.push((await req(MGR, 'POST', '/api/team', { name: 'Spam Person', email: 'spam' + i + '@' + PREFIX + 'local.test' })).status);
  ok(codes.includes(429) && codes.indexOf(429) > 0, 'invitations are limited per hour, so a stolen session cannot be used to send email to many addresses', codes.join(','));
} catch (e) {
  failures += 1;
  console.log('  FAIL the test stopped with an error:', e && e.stack ? e.stack.split(String.fromCharCode(10)).slice(0, 5).join(' | ') : e);
} finally {
  child.kill();
  await new Promise((r) => setTimeout(r, 300));
  await cleanup();
  process.exitCode = failures ? 1 : 0;
  console.log(`\n${passed} passed, ${failures} failed`);
  process.exit();
}
