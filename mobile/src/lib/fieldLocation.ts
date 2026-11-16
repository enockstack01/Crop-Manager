import * as Location from 'expo-location';

/**
 * The exact point of a field (same rules as server/src/lib/fieldLocation.js). Every field needs one: the weather for the field is read at
 * that point, never at the position of the phone that is recording the data. The phone's position is read ONLY after the person says they
 * are standing in the field and presses the button.
 *
 */
export { coordinateError, sixDecimals, ROUGH_METRES } from './coordinates';
import { sixDecimals } from './coordinates';

export type Reading = { lat: number; lon: number; accuracy: number };

/** Reads the phone's position once, at the best accuracy it can give. Rejects with a message the person can act on. */
export async function readExactPosition(): Promise<Reading> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw new Error(perm.canAskAgain === false
    ? 'Location is switched off for CropManager. Turn it on in the phone settings, or type the coordinates instead.'
    : 'Location was not allowed. Allow it to measure the field, or type the coordinates instead.');
  if (!(await Location.hasServicesEnabledAsync())) await Location.enableNetworkProviderAsync().catch(() => {});
  if (!(await Location.hasServicesEnabledAsync())) throw new Error('Location is switched off on this phone. Turn it on, or type the coordinates instead.');
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 45000));
  try {
    const p = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation }), timeout]);
    return { lat: sixDecimals(p.coords.latitude), lon: sixDecimals(p.coords.longitude), accuracy: Math.round(p.coords.accuracy || 0) };
  } catch {
    throw new Error('Finding your position took too long. Go to open ground and try again, or type the coordinates instead.');
  }
}
