/**
 * Runtime configuration, read from Expo public env vars (EXPO_PUBLIC_*).
 * Copy `.env.example` to `.env` and fill these in before running.
 */
import { pickApiOrigin, pickApiUrl } from './lib/apiUrl';

export const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

// a release app never uses a developer address (see lib/apiUrl.ts): that is what made phones say "can't reach CropManager" after signing in
export const API_URL = pickApiUrl(process.env.EXPO_PUBLIC_API_URL, __DEV__);

/** Origin (no /api) used to absolutise relative `/uploads/...` URLs from the API. */
export const API_ORIGIN = pickApiOrigin(process.env.EXPO_PUBLIC_API_ORIGIN, API_URL, __DEV__);

/** Turn a possibly-relative media URL from the API into an absolute one. */
export function mediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^(https?|file|content|data):/i.test(url)) return url; // a photo still on this phone has a file or content address
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

if (!CLERK_PUBLISHABLE_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[CropManager] EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set: copy mobile/.env.example to mobile/.env',
  );
}
