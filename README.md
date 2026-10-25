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

## AI assistant

The AI features run on the server only. Set `AI_API_KEY` in `server/.env` (or the host's environment) and restart the server; never commit the key. Which model answers is chosen by an administrator under **System admin > AI** (Fast, Balanced, Advanced and Expert levels, one per kind of task, plus per-user hourly and daily limits and a usage and failure monitor); the model names are never shown in the apps. `AI_DAILY_LIMIT` (default 40 requests per user per day) and `AI_HOURLY_LIMIT` (default 15) are the starting limits. `AI_MOCK=1` returns canned answers for development.

Features (web and mobile, answered in the interface language): chat that looks up the farmer's own records and the weather, farm insights, plans and advice, lender-ready season summary, quick record entry in plain words, **plant check from the camera** (up to three photos; finds the infected part, names the problem, treatment and medication, with a PDF report), and **calculator reports** (see below). Farm records are sent to the AI service with each request; usage is logged per user in the `aiusages` collection.

## Weather, calculators, calendar, reports and exports

- **Weather** (`/weather`): the farm's location comes from a field's GPS or, failing that, the farm's place name. Data comes from OpenWeatherMap when `OPENWEATHER_API_KEY` is set (a new key can take a couple of hours to activate), otherwise from the free Open-Meteo service. The page shows now, the next hours, seven days, rule-based advice for the crops in the ground, a water plan (crop water use against useful rain) and an AI weekly briefing.
- **Calculators**: pick one of your fields to fill the area, use the weather water plan for irrigation and rainfall, then "Explain with my farm data" for an AI report (what each result means, other estimates, steps, links to your records and the weather) and download it as a branded PDF.
- **Calendar** (`/calendar`, `GET /api/calendar`): month, week and agenda views, colour-coded by kind (planting, harvest, field work, irrigation, fertiliser, protection, scouting, equipment service), with alerts for overdue harvests, low or expiring stock, service due and heavy rain, heat or frost.
- **Reports**: filters for farm, crop, season and dates; a crop filter shows only that crop (sections with no records are left out). Every table is exported in full (PDF, Excel or CSV): wide tables switch to landscape and columns share the width, so nothing is cut off.
- **Exports** (`GET /api/export/:path?format=pdf|xlsx|csv`, `GET /api/export` for everything, `POST /api/export/tables` for a report built on the device): every records page has an Export button, and Settings has "Export all my records". The same server code serves the web and the mobile app.
- **Pictures**: any picture format is accepted (JPG, PNG, HEIC/HEIF from iPhones, WebP, AVIF, GIF, TIFF, BMP, SVG), from the gallery, the device or the camera. The server identifies the file by its content, turns it upright, flattens transparency, limits it to 2000 px and stores it as a JPEG, so the AI always gets a clean, small picture. `node server/src/scripts/test-images.mjs <a .heic file>` checks every format.
- **Account approval**: no account can open any farm data, upload a file, use the AI or export anything until a system administrator approves it (403 with the reason until then). That includes farmers who arrive through an organization referral link or an organization's bulk import: they are linked to the organization but wait in the administrators' approval queue, with the request filled in from the organization.
- **User ID**: every account has a stable ID such as `Crop384512`, shown in the top bar and Settings and printed on reports.
- **Search**: the top bar searches pages and all your records; records pages open with their own search filled in.
- **Languages**: English, French, Kinyarwanda, Swahili, Arabic (right to left), German, Spanish, Hindi, Portuguese and Chinese. `python scripts/i18n/build.py` collects the strings, `node scripts/i18n/ai_translate.mjs <codes>` fills gaps with the AI service, then run build.py again.

## Organizations and farmer referrals

Cooperatives, NGOs, companies and programmes can have their own accounts, bring farmers onto CropManager with referral links and see a summary of their farmers' crop activity (specification: Logistack "Organization Accounts and Farmer Referral Architecture" v1.0). Crop activity only: farms, fields, crop cycles, planting, activities, irrigation, fertilizer, crop protection, scouting and harvests. Finances, inventory and equipment are never shared.

- **Roles:** system administrator (the existing admin flag), organization administrator, organization field officer, farmer. Every route checks membership and role on the server.
- **Flow:** an organization registers (pending), a system administrator approves it and sets its farmer limit, the organization creates referral links (valid six hours, with a cap on farmers per link), farmers open the link, sign up or in, agree to share a summary and join. Referred farmers are approved automatically. A farmer belongs to one organization at a time and can leave in Settings.
- **Limits:** the farmer limit and each link's cap are taken with atomic updates, so simultaneous sign-ups cannot exceed them. Links are validated with server time when opened and again when submitted. Link tokens are stored only as hashes.
- **Settings** (System Settings, organization settings): link validity (default 6 hours), default farmer limit, default farmers per link, days before a farmer counts as inactive.
- **Migration:** `npm run migrate-orgs --workspace server` (add `-- --dry` to preview, `-- --rollback --yes` to undo). Existing users stay independent farmers.
- **Tests:** with the API running (`ALLOW_DEV_AUTH=1 PORT=5075 node server/src/index.js`) run `npm run test:orgs --workspace server`.
- **Public link address:** set `PUBLIC_APP_URL` (default `https://crop.agricoders.com` in production).
