/**
 * Runtime configuration, read from Expo public env vars (EXPO_PUBLIC_*).
 * Copy `.env.example` to `.env` and fill these in before running.
 */
export const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:5000/api';

/** Origin (no /api) used to absolutise relative `/uploads/...` URLs from the API. */
export const API_ORIGIN =
  process.env.EXPO_PUBLIC_API_ORIGIN ?? API_URL.replace(/\/api\/?$/, '');

/** Turn a possibly-relative media URL from the API into an absolute one. */
export function mediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

if (!CLERK_PUBLISHABLE_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[CropManager] EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set — copy mobile/.env.example to mobile/.env',
  );
}
