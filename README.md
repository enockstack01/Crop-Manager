# CropManager (MERN)

Crop production management system — **MongoDB + Express + React + Node**, with
**Clerk** authentication. Same product and UI as the original static build; the
Supabase backend has been replaced with an Express API on MongoDB Atlas.

```
├── server/   Express + Mongoose REST API (Clerk-protected)
├── client/   React (Vite) SPA — reuses the original CSS design system verbatim
└── mobile/   Expo / React Native app (Android + iOS) — same API, same Clerk instance
```

The **mobile app** is a standalone Expo project (not an npm workspace). It has
full parity with the web app's user-facing modules — dashboard, all 18 CRUD
modules, calculators, reports, calendar, settings — driven by the same generic
config pattern. See [`mobile/README.md`](mobile/README.md) for setup.

## Prerequisites

- Node.js 20+
- A MongoDB database (Atlas connection string)
- A Clerk application (publishable + secret keys) — https://clerk.com

## Setup

```bash
npm install                     # installs both workspaces

cp server/.env.example server/.env      # fill in MONGODB_URI + CLERK_* keys
cp client/.env.example client/.env      # fill in VITE_CLERK_PUBLISHABLE_KEY
```

## Run (development)

```bash
npm run dev
```

Runs both processes concurrently:

| Service | URL |
|---|---|
| API (Express) | http://localhost:5000 |
| Web (Vite)    | http://localhost:5173 |

Open http://localhost:5173, **sign up** with Clerk, complete the one-time
onboarding step, and you land on the dashboard.

> If the server logs `SRV lookup failed via system DNS`, it automatically retries
> with public resolvers (1.1.1.1 / 8.8.8.8). You can also set `DNS_SERVERS` in
> `server/.env`.

## Seed demo data

**Everything at once** — creates three demo accounts (one admin) and seeds each
with a full realistic dataset:

```bash
npm run bootstrap-demo
```

It prints the sign-in emails and a shared password. The admin account is the
first address in `ADMIN_EMAILS`. Test-mode emails use Clerk verification code
`424242`. Re-running re-seeds the same users.

**One user** — populate a dataset (farms, fields, crop cycles, 12 months of
harvests / expenses / sales, inventory, scouting, alerts):

```bash
npm run seed -- <clerk-user-id>
```

Find a Clerk user id in the Clerk dashboard, or run `window.Clerk.user.id` in
the browser console while signed in. The seeder **replaces** that user's rows.

## Administration

A user is a **platform admin** when their `Profile.is_admin` is true. Admins are
granted automatically on sign-in if their email is on the allowlist — the
`ADMIN_EMAILS` env list (immutable) plus a DB-managed list editable in the UI.
`is_admin` is never settable through the normal profile update.

Admins get an **Administration** section in the sidebar:

| Page | What it does |
|---|---|
| `/admin` | Platform-wide KPIs, record counts per module, recent sign-ups |
| `/admin/users` | Every user with data counts; promote/demote admin, deactivate/reactivate, re-seed, delete (removes the Clerk account + all their data) |
| `/admin/users/:id` | One user's account, access controls, data breakdown, recent activity |
| `/admin/data` | Browse every collection (filter by user), inspect a record's JSON, delete any record |
| `/admin/settings` | App + database health, collection counts, and the admin allowlist manager |

Deactivated non-admin accounts are blocked from the entire API
(`403 — account deactivated`). `/api/admin/*` requires an active admin; a user
cannot revoke their own admin or active status.

**Grant admin (and optionally seed) from the CLI:**

```bash
npm run grant-admin -- someone@example.com --seed
```

## Architecture

### Server (`server/src`)

- **`models/`** — one Mongoose schema per collection, field-for-field identical to
  the original Supabase tables. `user_id` (a Clerk user id string) scopes every
  document; `created_at` / `updated_at` timestamps; `toJSON` maps `_id → id`.
- **`resources.js`** — a declarative registry describing each resource's
  searchable fields, equality filters and relations to populate.
- **`lib/crudController.js` + `routes/generic.routes.js`** — one factory builds a
  full `GET/POST/PUT/PATCH/DELETE /api/:resource` surface for every registry entry
  (pagination, sort, search, filters). `lib/shape.js` restores the original
  embedded-relation shape (`farm_id` + sibling `farms: { name }`) so the frontend
  stays simple.
- **Special endpoints** — `GET /api/dashboard` (the 11 datasets the dashboard
  aggregates), `GET/PUT /api/profile`, `POST /api/uploads` (scouting photos →
  `server/uploads/`, swap for S3 later), `POST /api/inventory-items/:id/stock`.
- **Auth** — `@clerk/express` `clerkMiddleware()` + a `requireAuth` guard that
  sets `req.userId`; `loadProfile` then upserts the profile, stamps
  `last_seen_at`, blocks deactivated accounts and attaches `req.profile`.
  Helmet, CORS, rate-limiting and a central error handler are applied to `/api`.
- **Admin** — `/api/admin/*` (guarded by `requireAdmin`): platform overview,
  user management (`is_admin` / `is_active` / delete), and a cross-user data
  browser. Seeding lives in `lib/seedData.js` (`seedUser`), reused by the
  `seed` and `bootstrap-demo` scripts and the admin delete path.

### Client (`client/src`)

- **`styles/`** — the original 13 CSS files, copied unchanged. All class names and
  dark-mode behaviour (`.dark-mode` on `<html>`) are preserved.
- **`lib/api.js`** — axios instance; a request interceptor injects the Clerk
  session token.
- **`lib/useResource.js`** — React Query hooks (`useList` / `useAll` / `useOne` /
  `useResourceMutations`) parametrised by resource name.
- **`components/CrudPage.jsx` + `ResourceForm.jsx`** — drive every list/CRUD
  screen (table, toolbar, filters, pagination, create/edit modal, delete confirm,
  view modal) from a small per-page config.
- **`features/dashboard/`** — the full multi-section dashboard (KPIs + Chart.js
  charts via `react-chartjs-2`), a near-verbatim port of the original
  `dashboard.js` aggregation logic.
- **`lib/calculators.js`** — the 9 agricultural calculators (pure client-side
  math, ported unchanged); results can be saved to `calculation-history`.

## Production build

```bash
npm run build          # builds client/dist
npm start              # serves the API; deploy client/dist to any static host
```

## Notes

- **Secrets:** `server/.env` / `client/.env` are git-ignored. If the MongoDB
  password or `CLERK_SECRET_KEY` were ever shared in plaintext, rotate them and
  restrict the Atlas IP allow-list.
- **Testing hook:** in non-production, setting `ALLOW_DEV_AUTH=1` lets requests
  authenticate with an `x-dev-user: <id>` header (for `curl` / integration
  tests). Off by default.
