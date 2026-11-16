/**
 * The rules for the exact point of a field (same as server/src/lib/fieldLocation.js). Plain functions with no phone code, so they are tested
 * on a computer (mobile/scripts/test-fieldlocation.mjs).
 */
const toNumber = (v: unknown) => (v === '' || v === null || v === undefined ? NaN : Number(v));

/** A message when the coordinates are missing or impossible, else null. */
export function coordinateError(latitude: unknown, longitude: unknown): string | null {
  const lat = toNumber(latitude);
  const lon = toNumber(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 'Enter the exact latitude and longitude of the field. They are needed to show the weather at the field.';
  if (Math.abs(lat) > 90) return 'Latitude must be between -90 and 90.';
  if (Math.abs(lon) > 180) return 'Longitude must be between -180 and 180.';
  if (lat === 0 && lon === 0) return 'The coordinates 0, 0 are in the ocean off Africa. Enter where the field really is.';
  return null;
}

/** Six decimals is about 10 centimetres: more than a phone can measure. */
export const sixDecimals = (n: number) => Math.round(Number(n) * 1e6) / 1e6;

/** How good a reading is: the person is told when it is too rough to trust. */
export const ROUGH_METRES = 100;

