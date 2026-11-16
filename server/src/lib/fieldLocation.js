/**
 * The exact point of a field. Every field must have one: weather, advice and the organization map all read the field's own coordinates,
 * never the position of the phone that happens to be recording the data.
 */
export const COORDINATE_HELP = 'Enter the exact latitude and longitude of the field, for example -1.950000 and 30.060000.';

const toNumber = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));

/** A message when the coordinates are missing or impossible, else null. */
export function coordinateError(latitude, longitude) {
  const lat = toNumber(latitude);
  const lon = toNumber(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 'The field needs its exact coordinates: latitude and longitude. ' + COORDINATE_HELP;
  if (Math.abs(lat) > 90) return 'Latitude must be between -90 and 90.';
  if (Math.abs(lon) > 180) return 'Longitude must be between -180 and 180.';
  if (lat === 0 && lon === 0) return 'The coordinates 0, 0 are in the ocean off Africa. Enter where the field really is.';
  return null;
}

export const hasCoordinates = (f) => !!f && coordinateError(f.latitude, f.longitude) === null;
