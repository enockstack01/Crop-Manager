# Testing

One command runs every server suite (it starts its own test server; nothing calls Clerk, Hugging Face or the AI provider):

    npm run build
    npm run test:all --workspace server        # 11 suites, 331 checks on 9 Nov 2026

| Suite | Checks | What it proves |
|---|---:|---|
| security | 85 | who can reach what, organization isolation, uploads, export, account deletion |
| orgs | 68 | organizations, referral links, limits, dashboard figures |
| invites | 18 | farmer invitations by email and first sign-in matching |
| workspace | 31 | staff invitations, pending list, farmer records, team roles, activity log, role home pages |
| tenancy | 14 | a record cannot link to another farmer's data; long lists reach the pickers |
| images | – | every picture format becomes a clean JPEG |
| storage | 20 | local disk and S3-compatible storage (against a fake S3) |
| ratelimit | 10 | shared limits across instances and restarts |
| vision | 34 | classifier wrapper, timeouts, circuit breaker, no secret in logs |
| diagnose-vision | 15 | photo diagnosis end to end with the mock AI |
| hardening | 35 | headers, Content Security Policy, caching, production behaviour |

Mobile rules (no phone needed): `cd mobile && npx tsc --noEmit && node scripts/test-policy.mjs && node scripts/test-note.mjs && node scripts/test-checksum.mjs`.

Other tools: `server/src/scripts/bench-org.mjs` (organization dashboard speed with N farmers), `eval-classifier.mjs` (classifier accuracy from a review CSV), `score-offline-answers.mjs` (offline assistant replies), `check-ai-features.mjs` (every AI feature against the real service, costs money). Phones: `docs/DEVICE-TESTS.md`.

Needs `MONGODB_URI` and the Clerk keys in `server/.env` (any value for the Clerk keys is fine for these suites). CI runs the same commands, see `.github/workflows/ci.yml`.

Sign-in checks against your real Clerk instance (not part of `test:all`, they use the network and your keys): `node server/src/scripts/check-clerk-settings.mjs` (read-only) and `node server/src/scripts/check-clerk-auth.mjs` (development instance only; creates and deletes a test user). See `docs/AUTH-GUIDE.md`.
