# The farm manager and the data collectors

One relationship, used by the whole platform: records, field work, tasks, the greenhouse, the dashboards, exports and the phone app.

## Who is who

**The farm manager** is the owner of the farm's records. They see everything on their dashboard (the farm, the harvest, work, stock, equipment, finances, reports, the calendar, the greenhouse and the AI assistant), and can edit and delete records. They add help in the field from the **Team** page (website and phone).

**A data collector** is someone the farm manager adds to help in the field. They work in the manager's farm from a simpler dashboard. Everything they record is saved into the manager's farm and tagged with their name; the manager sees it straight away.

| | Farm manager | Data collector |
|---|---|---|
| Dashboard | the whole farm, with a team card | **Today**: entries today and this week, a big button for each kind of field record, their open tasks, the fields that need a check, their own latest entries |
| Field records (planting, activities, irrigation, fertilizer, crop protection, scouting, harvest) | add, edit, delete | add; edit **only their own** entries; never delete |
| Greenhouse | everything | the plan view and recording (the greenhouse applies its own rules: no layout, crops, disease details or team) |
| Farm, fields, crops, varieties, seasons, crop cycles | add, edit, delete | read only (to choose a field or a crop) |
| Finances (expenses, sales), reports, exports, the calendar, the AI assistant, inventory, equipment | yes | no |
| Tasks | create, edit, delete, see who completed them | see their own and the ones for everyone, mark them done with a note |
| Team | add, follow, cancel an invitation, remove | no |
| Farm profile | change | no |

The server decides all of this on every request (`server/src/lib/farmPolicy.js`, enforced in `server/src/middleware/farmContext.js` and `server/src/lib/crudController.js`). The website and the phone only hide what the server would refuse. A refusal always says why.

## Adding a data collector

1. The farm manager opens **Team** and taps **Add data collector**, then enters the collector's **name**, **email address** and, if they want, a **phone number**.
2. The collector receives an **email invitation** (through the sign-in service) with a link to set a password.
3. At the **first sign-in** with that address (it must be verified) the invitation **becomes their account** and links them to that manager's farm. The farm manager is told.
4. The account then **waits for a system administrator's approval**, like every account on the platform. The administrator sees "Data collector" and the farm manager's name in the request.
5. Once approved the collector gets the field-work dashboard.

Rules: an address that already has its own farmer, administrator or organization account cannot be a data collector (they need a separate login). A collector works for one farm at a time. An invitation not accepted in 30 days reads as expired and can be sent again. A collector who already has an account and no farm (for example removed earlier) is linked at once when added again.

## What the farm manager sees

- **Every entry carries who recorded it** (`recorded_by`, `recorded_by_name`): a "Recorded by" column on the record lists and in exports.
- The **Team page**: each collector's entries this week, last activity, status; open one to see their latest entries.
- The **dashboard's team card**: the same, at a glance.

## Ending a collector's access

The farm manager can **cancel a waiting invitation** or **remove a collector** at any time. Removing one ends their access at once (they are told so when they next open the app); the entries they already made **stay in the farm's records**, still tagged with their name. A collector is also locked out while an administrator has their farm manager's account on hold or deactivated.

## How it works

Every record is stored under its owner's id, and every route reads that id as the farm. For a data collector `farmContext` moves the request onto the manager's farm (`req.userId` becomes the manager, the real person stays in `req.actorId`), so every module works for a collector without changes of its own, and one policy file decides what they may reach.

API (all under `/api`, farm manager only): `GET /team` (`?include=removed`), `POST /team` (name, email, phone), `GET /team/:id` (with latest entries), `PUT /team/:id` (name, phone), `POST /team/:id/resend`, `DELETE /team/:id`. Collector: `GET /dashboard/collector`. Tasks: the usual records routes at `/tasks`, which for a collector are limited to their own tasks and marking them done.

Earlier greenhouse invitations keep working (the team is stored in the same collection). The older "greenhouse manager" role (a second person who reads the greenhouse records) is no longer offered; people who have it are shown on the Team page and can be removed there.

## Checks

`server/src/scripts/test-farmteam.mjs` (78 checks) runs the whole story against the API: invitation, first sign-in, waiting for approval, permissions, tagging, tasks, dashboards, the team list, cancelling, removing, adding again, exports and the manager's account status. `mobile/scripts/test-team.mjs` checks the phone's rules and that the phone, the website and the server list the same records for a collector.
