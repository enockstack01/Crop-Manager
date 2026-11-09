# Sign-in and permissions: how it works and how to fix it with Clerk

## How it works
1. A person signs in with Clerk (web or phone). Clerk gives the app a short-lived **session token**.
2. Every app request sends it as `Authorization: Bearer <token>`. The server checks it with `CLERK_SECRET_KEY` (`server/src/middleware/clerkSession.js`, `auth.js`).
3. The server then looks up the person's own profile (`loadProfile`). A **new** account may only reach `/api/profile` until it asks for access and an administrator approves it (`account_status`: new → pending → active). Farm data answers **403** until then; organization accounts only reach the organization workspace.
4. **Administrators** are the verified email addresses listed in the server setting `ADMIN_EMAILS` (or added in the admin screen). The right is given the first time that person's profile loads.

Because the token, the server and both apps must agree on **one Clerk instance**, most "sign-in does not work" problems are settings, not code.

## Tools in this repository (run from `server/`)
| Command | What it does | Safe on production? |
|---|---|---|
| `node src/scripts/check-clerk-settings.mjs` | Reads the Clerk settings sign-in needs (email verification, Google, mobile redirect allowlist, native API) and prints what to change | Yes, read-only |
| `node src/scripts/check-clerk-auth.mjs` | Creates a throwaway user and real session, calls the real API and checks sign-in, approval and admin rules; deletes everything | **Development instance only** |

## What was found and fixed in the code
| Problem | Effect | Fix |
|---|---|---|
| A damaged login token (shape of a token, broken content) crashed Clerk's parser | Server answered **500** with an error page; the app could not tell it must sign in again; the public referral page broke too | `clerkSession.js`: such a token counts as "not signed in": protected routes answer 401, public routes still work. Tests in `test:hardening` |
| The web app restarted Clerk on every language change | Reloaded the session and threw away a half-finished sign-in | `main.jsx`: Clerk stays mounted; only the screens remount |
| The server hid failures reading the user from Clerk | A wrong `CLERK_SECRET_KEY` meant no email, so nobody became administrator and invitations never matched, with no message | `profile.controller.js` now logs `[clerk] could not read the signed-in user…` (once a minute) |

## What can only be fixed in the Clerk dashboard or settings
Your **development** instance (`saved-slug-1432`) passes every check above. The remaining causes are in how it is set up for production and in the phone app:

1. **One instance everywhere.** Four values must come from the same Clerk instance: `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` (Render), `VITE_CLERK_PUBLISHABLE_KEY` (the web app; it is baked in when the web app is **built**, so set it in Render's build environment and redeploy after any change) and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (baked into the APK). Mixed instances = every request is 401.
2. **The APK currently talks to the development instance** (`mobile/eas.json` has a `pk_test_` key, and the app logs "Clerk has been loaded with development keys"). If Render uses the production instance, phones can never sign in to it. For production: create the Production instance in Clerk, put its `pk_live_` key in `eas.json`, rebuild the APK, and use its `sk_live_` key on Render.
3. **Production instance needs its domain.** Clerk dashboard → Domains: add your domain and the DNS records Clerk lists, otherwise sign-in works only on the development URL.
4. **Google sign-in in production** needs your own Google OAuth client ID and secret in Clerk (Configure → SSO connections → Google), with Clerk's redirect URI added in Google Cloud. The shared test credentials work only on development.
5. **Phone sign-in with Google:** Clerk dashboard → Configure → Native applications → enable the Native API and add `cropmanager://sso-callback` to the allowlist for mobile SSO redirects (already done on the development instance; it must be repeated on the production instance).
6. **Email verification at sign-up** must be on (Configure → Email, phone, username → Email address → Verify at sign-up). Only verified addresses can become administrators or accept invitations.
7. **Server settings:** `ADMIN_EMAILS` (comma separated, lower case), `PUBLIC_APP_URL` and `CLIENT_ORIGIN` set to the real site, `ALLOW_DEV_AUTH` and `AI_MOCK` absent.

## Symptom → cause
| Symptom | Likely cause |
|---|---|
| Signs in, then every screen fails with 401 | Secret key and publishable key from different instances (item 1) |
| Works on the web, not on the phone | Native API off or redirect not allowlisted (5), or the APK uses another instance (2) |
| Signs in but sees "Please submit your account request" | By design: a new account must be approved. Approve it in the admin screen |
| Your own admin email is not an administrator | Address not in `ADMIN_EMAILS`, or not verified in Clerk (6), or the server cannot read Clerk (look for `[clerk]` in the Render log) |
| Invitation email sent but the person is not linked | They signed up with a different address, or it was not verified |
| Sign-in screen restarts when switching language | Fixed (see above); rebuild and redeploy the web app |

## Still to do (not changed here)
- `@clerk/clerk-expo` is deprecated: migrate the mobile app to `@clerk/expo` (the app prints this at start).
- Clerk recommends `authorizedParties` on the server for cookie sessions. It was left out on purpose: set it to your real site addresses once they are final, otherwise a wrong value would lock everyone out.
