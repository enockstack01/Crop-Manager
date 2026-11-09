/**
 * Reads the Clerk dashboard settings that sign-in depends on (read-only; nothing is changed):
 *
 *   node src/scripts/check-clerk-settings.mjs
 *
 * Uses CLERK_SECRET_KEY from server/.env to read the instance, and the public Frontend API of the instance in CLERK_PUBLISHABLE_KEY.
 * Prints what is switched on and what the mobile and web apps need that is missing. The secret key is never printed.
 */
import { env } from '../config/env.js';

const sk = env.clerkSecretKey;
const pk = env.clerkPublishableKey;
const frontend = Buffer.from(pk.split('_').slice(2).join('_'), 'base64').toString().replace(/\$$/, '');
const get = async (url, headers = {}) => {
  const r = await fetch(url, { headers });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
let todo = 0;
const line = (ok, text, fix) => { console.log(`${ok ? 'ok  ' : 'TODO'} ${text}`); if (!ok) { todo += 1; console.log(`       -> ${fix}`); } };

console.log(`Clerk instance: ${frontend} (${pk.startsWith('pk_live_') ? 'PRODUCTION' : 'development'})\n`);

const envRes = await get(`https://${frontend}/v1/environment`);
if (envRes.status !== 200) { console.log(`Could not read the instance (${envRes.status}). Check CLERK_PUBLISHABLE_KEY.`); process.exit(1); }
const e = envRes.body;
const us = e.user_settings || {};
const attrs = us.attributes || {};
const social = us.social || {};

console.log('Sign-in methods');
line(!!attrs.email_address?.enabled, `email address is a sign-in field (${(attrs.email_address?.verifications || []).join(', ') || 'no verification'})`, 'Clerk dashboard > Configure > Email, phone, username > turn on Email address and "Verify at sign-up". The server only trusts VERIFIED emails for admin rights and invitations.');
line((attrs.email_address?.verifications || []).length > 0 || !attrs.email_address?.enabled, 'email addresses must be verified at sign-up', 'Turn on "Verify at sign-up" for Email address: unverified addresses cannot become administrators or accept invitations.');
const google = social.oauth_google;
line(!!google?.enabled, 'Google sign-in is enabled', 'Clerk dashboard > Configure > SSO connections > Add connection > Google.');
if (google?.enabled) {
  const shared = pk.startsWith('pk_test_');
  console.log(`     (Google uses ${shared ? "Clerk's shared test credentials: fine for development only" : 'your own Google credentials'})`);
  if (!shared) console.log('     In production Google needs YOUR OAuth client ID and secret in Clerk, with Clerk\'s redirect URI added in the Google Cloud console.');
}
console.log(`     sign-up mode: ${e.auth_config?.single_session_mode ? 'single session' : 'multi session'}; first factors: ${(e.auth_config?.first_factors || []).join(', ') || 'default'}`);

console.log('\nThe mobile app (Google sign-in returns to cropmanager://sso-callback)');
const redirects = await get('https://api.clerk.com/v1/redirect_urls', { Authorization: `Bearer ${sk}` });
if (redirects.status === 200) {
  const urls = (Array.isArray(redirects.body) ? redirects.body : redirects.body.data || []).map((r) => r.url);
  line(urls.some((u) => /^cropmanager:\/\/sso-callback/.test(u)), `the redirect "cropmanager://sso-callback" is on the allowlist (${urls.length} listed)`, 'Clerk dashboard > Configure > Native applications > "Allowlist for mobile SSO redirect" > add  cropmanager://sso-callback  (without it Google sign-in works on the web but fails or loops on the phone).');
} else {
  line(false, `could not read the redirect allowlist (${redirects.status})`, 'Check CLERK_SECRET_KEY, then add cropmanager://sso-callback under Configure > Native applications.');
}
const native = await get(`https://${frontend}/v1/client?_is_native=1`);
line(native.status === 200 || native.status === 401, `the instance answers native (mobile) requests (${native.status})`, 'Clerk dashboard > Configure > Native applications > turn on the Native API (it is off by default and the mobile app cannot sign in without it).');

console.log('\nThe apps and the server');
console.log('     All three must use ONE Clerk instance. Run  node src/scripts/check-clerk-auth.mjs  to test that end to end.');
console.log(`\n${todo ? `${todo} setting(s) to change in the Clerk dashboard (marked TODO).` : 'The Clerk settings that sign-in needs are in place.'}`);
