/**
 * Checks the farm manager / data collector rules on the phone (src/lib/teamRules.ts) and that the phone, the website and the server agree on
 * which records a data collector may enter.
 *
 *   node mobile/scripts/test-team.mjs
 */
import fs from 'node:fs';
import { COLLECTOR_RESOURCES, COLLECTOR_ROUTES, agoParts, collectorMayOpen, inviteProblem, isCollector, mayAdd, mayDelete, mayEdit, mayExport, MEMBER_STATUS } from '../src/lib/teamRules.ts';
import { OPERATIONAL, collectorMayCall } from '../../server/src/lib/farmPolicy.js';

let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };

const mgr = { user_type: 'farmer', user_id: 'm1' };
const col = { user_type: 'collector', user_id: 'c1' };

console.log('who may do what');
ok(isCollector(col) && !isCollector(mgr) && !isCollector(null) && !isCollector(undefined), 'a data collector account is told apart from a farm manager\'s');
ok(COLLECTOR_RESOURCES.every((r) => mayAdd(col, r)) && !mayAdd(col, 'expenses') && !mayAdd(col, 'farms') && !mayAdd(col, 'sales'), 'a collector adds field work, not finances or the farm\'s set-up');
ok(['expenses', 'farms', 'fields', 'equipment'].every((r) => mayAdd(mgr, r)) && mayAdd(null, 'expenses'), 'the farm manager adds anything');
ok(mayEdit(col, 'field-activities', { recorded_by: 'c1' }) && !mayEdit(col, 'field-activities', { recorded_by: 'm1' }) && !mayEdit(col, 'field-activities', { recorded_by: 'c2' }) && !mayEdit(col, 'field-activities', {}) && !mayEdit(col, 'field-activities', null), 'a collector edits only the entries they recorded');
ok(!mayEdit(col, 'expenses', { recorded_by: 'c1' }) && mayEdit(mgr, 'expenses', { recorded_by: 'c1' }) && mayEdit(mgr, 'field-activities', {}), 'never finances; the farm manager edits everything');
ok(!mayDelete(col) && mayDelete(mgr) && !mayExport(col) && mayExport(mgr), 'a collector never deletes or exports; the farm manager does');

console.log('the three lists agree');
ok(JSON.stringify([...COLLECTOR_RESOURCES].sort()) === JSON.stringify([...OPERATIONAL].sort()), 'the phone and the server list the same records for a data collector');
const web = fs.readFileSync(new URL('../../client/src/components/profile.jsx', import.meta.url), 'utf8');
const webList = [...(web.match(/COLLECTOR_RESOURCES = \[([^\]]+)\]/)?.[1] || '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
ok(JSON.stringify(webList.sort()) === JSON.stringify([...OPERATIONAL].sort()), 'and so does the website');
ok(COLLECTOR_RESOURCES.every((r) => collectorMayCall('POST', r).ok && !collectorMayCall('DELETE', `${r}/x`).ok), 'everything the phone offers a collector to add, the server accepts, and refuses to delete');
ok(!collectorMayCall('POST', 'expenses').ok && !mayAdd(col, 'expenses'), 'what the phone hides, the server refuses');

console.log('the collector\'s screens');
ok(['dashboard', 'tasks', 'activities', 'scouting', 'greenhouse', 'weather', 'settings'].every(collectorMayOpen) && !['expenses', 'sales', 'reports', 'calendar', 'assistant', 'team', 'farms', 'inventory', 'equipment'].some(collectorMayOpen), 'a collector can open their work screens, and none of the finance, reports, calendar, assistant or team screens');
ok(COLLECTOR_ROUTES.length === new Set(COLLECTOR_ROUTES).size, 'no screen is listed twice');

console.log('the invitation form');
ok(inviteProblem({ name: 'Alice Uwase', email: 'alice@example.com', phone: '+250 788 000 111' }) === '' && inviteProblem({ name: 'Al', email: 'a@b.co' }) === '', 'a name, an email and an optional phone are enough');
ok(/name/i.test(inviteProblem({ name: '', email: 'a@b.co' })) && /name/i.test(inviteProblem({ name: ' A ', email: 'a@b.co' })), 'a name is needed');
for (const bad of ['', 'alice', 'alice@', '@example.com', 'a b@example.com']) ok(/email/i.test(inviteProblem({ name: 'Alice', email: bad })), `"${bad}" is not an email address`);
ok(/phone/i.test(inviteProblem({ name: 'Alice', email: 'a@b.co', phone: 'call me' })) && inviteProblem({ name: 'Alice', email: 'a@b.co', phone: '' }) === '', 'a phone number is optional but must look like one');
ok(inviteProblem({ name: 'Alice', email: 'a@b.co', phone: '+250788000111' }) === '', 'digits with a plus are fine');

console.log('how long ago');
const now = Date.parse('2026-11-21T12:00:00Z');
const at = (min) => new Date(now - min * 60000).toISOString();
ok(agoParts(null) === null && agoParts('nonsense') === null, 'no date, no answer');
ok(agoParts(at(0), now).key === 'just now' && agoParts(at(30), now).n === 30 && agoParts(at(30), now).key === '{{n}} minutes ago', 'minutes');
ok(agoParts(at(60), now).key === '1 hour ago' && agoParts(at(180), now).n === 3, 'hours');
ok(agoParts(at(24 * 60), now).key === 'yesterday' && agoParts(at(3 * 24 * 60), now).n === 3, 'days');
ok(agoParts(at(30 * 24 * 60), now).key === 'on {{date}}' && agoParts(at(30 * 24 * 60), now).date === '2026-10-22', 'a long time ago is a date');
ok(['active', 'invited', 'expired', 'removed'].every((s) => MEMBER_STATUS[s] && MEMBER_STATUS[s].label), 'every member status has a label');

console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
