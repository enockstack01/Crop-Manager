/**
 * The exact point of a field (same rules as server/src/lib/fieldLocation.js). Every field needs one: the weather for the field is read at
 * that point, not at the position of the phone or computer that is recording the data.
 */
const toNumber = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));

/** A message when the coordinates are missing or impossible, else null. */
export function coordinateError(latitude, longitude) {
  const lat = toNumber(latitude);
  const lon = toNumber(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 'Enter the exact latitude and longitude of the field. They are needed to show the weather at the field.';
  if (Math.abs(lat) > 90) return 'Latitude must be between -90 and 90.';
  if (Math.abs(lon) > 180) return 'Longitude must be between -180 and 180.';
  if (lat === 0 && lon === 0) return 'The coordinates 0, 0 are in the ocean off Africa. Enter where the field really is.';
  return null;
}

/** Six decimals is about 10 centimetres: more than a phone can measure. */
export const sixDecimals = (n) => Math.round(Number(n) * 1e6) / 1e6;

/** Reads the position of this device once, at full accuracy. Resolves { lat, lon, accuracy } (metres) or rejects with a message for the person. */
export function readPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('This browser cannot find your position. Type the coordinates instead.'));
    return navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: sixDecimals(p.coords.latitude), lon: sixDecimals(p.coords.longitude), accuracy: Math.round(p.coords.accuracy || 0) }),
      (e) => reject(new Error(e.code === 1
        ? 'Location is switched off for this site. Allow it in the browser, or type the coordinates instead.'
        : e.code === 3 ? 'Finding your position took too long. Try again, or type the coordinates instead.'
          : 'Your position could not be found. Try again, or type the coordinates instead.')),
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
    );
  });
}
