/*
 * Which server the app talks to. Pure functions with no phone code, so they can be tested on a computer (mobile/scripts/test-apiurl.mjs).
 *
 * The address comes from EXPO_PUBLIC_API_URL when the app is built. That setting lives in .env / .env.local for development, where it points at
 * the developer's PC (10.0.2.2 is how the Android emulator reaches it; 192.168.x.x is the PC on the home network). A RELEASE app built on the
 * same PC used to pick those files up and ship an address no phone can reach: sign-in worked (Clerk), then every request failed with
 * "can't reach CropManager". In a release build such an address is now ignored and the real server is used.
 */
export const PRODUCTION_ORIGIN = 'https://crop.agricoders.com';
export const PRODUCTION_API = `${PRODUCTION_ORIGIN}/api`;
export const EMULATOR_API = 'http://10.0.2.2:5000/api';

/** An address that only works on a developer's own machine or network. */
export function isLocalAddress(url?: string | null): boolean {
  if (!url) return false;
  const host = String(url).replace(/^[a-z]+:\/\//i, '').split(/[/:?#]/)[0].toLowerCase();
  if (host === 'localhost' || host === '10.0.2.2' || host === '10.0.3.2' || host.endsWith('.local')) return true;
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}

/** The API address for this build. `isDev` is true while developing (Metro), false in a release app. */
export function pickApiUrl(fromEnv: string | undefined, isDev: boolean): string {
  const given = (fromEnv || '').trim();
  if (isDev) return given || EMULATOR_API;
  if (!given || isLocalAddress(given)) return PRODUCTION_API; // a release app never uses a developer address
  return given;
}

/** The origin (no /api) used to build picture addresses. */
export function pickApiOrigin(fromEnv: string | undefined, apiUrl: string, isDev: boolean): string {
  const given = (fromEnv || '').trim();
  if (given && (isDev || !isLocalAddress(given))) return given;
  return apiUrl.replace(/\/api\/?$/, '');
}
