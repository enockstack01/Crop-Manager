# CropManager Mobile (Expo / React Native)

Native Android + iOS client for the CropManager MERN backend. It talks to the
**same Express API** and **same Clerk instance** as the web app — no backend
changes required.

```
mobile/
  src/
    env.ts                 runtime config (EXPO_PUBLIC_* vars)
    lib/                    api client, React Query hooks, formatters, options, calculators
    theme/                  design tokens ported from the web CSS + light/dark provider
    components/             UI kit (Screen, Card, Button, fields, Sheet, Toast, Confirm, charts, FAB)
    navigation/
      modules.tsx           ⭐ one config object per CRUD module — drives list + form + detail
      navConfig.ts          drawer layout (mirrors the web Sidebar sections)
      AppNavigator.tsx      drawer + stacks
    features/dashboard/     dashboard aggregation (port of Dashboard.jsx computeAggregates)
    screens/                Dashboard, CrudScreen, Calculators, Reports, Calendar, Settings, auth, onboarding
    App.tsx                 Clerk + React Query + Theme + Navigation providers
```

## Prerequisites

- Node.js 20 or 22 LTS (Node 26 works for Metro but is unsupported by Expo — a
  LTS is strongly recommended, especially for native Android builds)
- The CropManager API running and reachable from the device/emulator
- Android Studio (for the Android emulator / `eas build`) — **not required** to
  run in Expo Go
- A Clerk publishable key (same instance as `client/.env`)

## Setup

```bash
cd mobile
npm install --legacy-peer-deps          # clerk-expo v2 needs the flag
cp .env.example .env                     # fill in the two required vars
npx expo start                           # scan the QR with Expo Go, or press "a"
```

`.env`:

| Var | Example | Notes |
|---|---|---|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_…` | same key as the web client |
| `EXPO_PUBLIC_API_URL` | `http://10.0.2.2:5000/api` | `10.0.2.2` = host from the Android emulator; use your LAN IP for a physical device |
| `EXPO_PUBLIC_API_ORIGIN` | `http://10.0.2.2:5000` | `API_URL` without `/api` — used to load scouting photos |

### Let the API accept the app

The server's CORS `origin` is currently the web client only. For local device
testing set `CLIENT_ORIGIN` loosely or add the app origin. Native requests from
Expo don't send a browser `Origin` header, so CORS usually isn't the blocker —
the **network address** is. Make sure the phone/emulator can reach the API host.

## What's implemented

- **Auth** — Clerk email/password sign-in + email-code sign-up, session stored in
  `expo-secure-store`. One-time onboarding screen.
- **Dashboard** — KPI grid, land-utilization, cycle-status donut, harvest-by-crop
  and production-trend charts, revenue-vs-expenses, expense breakdown, alerts,
  upcoming harvests. Farm/season filters. Charts are hand-drawn `react-native-svg`.
- **All 18 CRUD modules** — farms, fields, crops, varieties, seasons, crop cycles,
  planting, activities, irrigation, fertilizer, crop protection, scouting (with
  camera/gallery photo upload), harvest, inventory (+ stock in/out), equipment,
  maintenance, expenses, sales. Each is ~1 config object in `navigation/modules.tsx`;
  list + search + filters + create/edit sheet + detail sheet + delete are shared.
- **Calculators** — all 9, identical math, save-to-history + reopen.
- **Reports** — production / yield / financial, tiles + chart + detail, farm & date filters.
- **Calendar** — upcoming expected-harvest agenda.
- **Settings** — profile edit, light/dark/system theme, sign out.

## Not yet ported

- Platform-admin screens (`/admin/*`)
- Offline write queue / optimistic mutations
- Push notifications
- CSV export / print from Reports (mobile has no filesystem-download equivalent yet)

## Android build (later)

```bash
npm i -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview   # cloud build → installable .apk
```

`android/` and `ios/` are git-ignored — run `npx expo prebuild` to generate them
when you need a bare/local build.
