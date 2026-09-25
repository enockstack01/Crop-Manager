# CropManager Mobile (Expo / React Native)

Native Android + iOS client for the CropManager MERN backend (Expo SDK 57). It talks to the
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

- Node.js 22 or 24 LTS
- The CropManager API running and reachable from the device/emulator
- Android Studio for the Android emulator — **not required** for Expo Go or
  EAS cloud builds
- A Clerk publishable key (same instance as `client/.env`)

## Setup

```bash
cd mobile
npm install                              # .npmrc sets legacy-peer-deps (clerk-expo's optional peers)
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

## Android build (EAS)

Cloud builds run on expo.dev from `eas.json`:

| Profile | Output | Use |
|---|---|---|
| `preview` | installable `.apk` | share with testers (internal distribution) |
| `development` | `.apk` with the dev client | live-reload development against `expo start` |
| `production` | `.aab` | Google Play submission |

```bash
npx eas-cli login                                  # once per machine
npx eas-cli init                                   # once: links the project on expo.dev
npx eas-cli build -p android --profile preview     # → download link + QR for the .apk
```

`mobile/.env` is git-ignored and **not uploaded** to EAS, so build-time
`EXPO_PUBLIC_*` values live in `eas.json` (`build.base.env`) — update the API
address there when it changes. While that address is plain `http://`,
`app.config.js` allows cleartext traffic (Android blocks it in release builds by
default); it switches off automatically for an `https://` API.

The phone must be able to reach the API: same Wi-Fi as the API host, with port
5000 allowed through the host's firewall.

`android/` and `ios/` are git-ignored — run `npx expo prebuild` to generate them
when you need a bare/local build.
