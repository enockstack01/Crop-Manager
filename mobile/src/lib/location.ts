import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

/**
 * The phone's position, used to give weather and farm advice for exactly where the farmer is.
 * Position is read only while the app is open (foreground permission) and is sent to the server
 * only as part of a weather request; it is not stored there.
 *
 *  - unknown:  not checked yet
 *  - ask:      permission not granted yet, can still be asked
 *  - blocked:  permission refused for good, only the phone's settings can change it
 *  - off:      permission granted but the phone's location switch is off
 *  - on:       permission granted and location is on
 */
export type LocationState = 'unknown' | 'ask' | 'blocked' | 'off' | 'on';
export type Coords = { lat: number; lon: number };

const round = (n: number) => Math.round(n * 100) / 100; // about 1 km: plenty for weather, and it makes cache hits likely

async function readState(): Promise<LocationState> {
  const perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted) return perm.canAskAgain === false ? 'blocked' : 'ask';
  return (await Location.hasServicesEnabledAsync()) ? 'on' : 'off';
}

async function readPosition(): Promise<Coords | null> {
  try {
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: round(p.coords.latitude), lon: round(p.coords.longitude) };
  } catch {
    // no fresh fix (indoors, slow GPS): the last one the phone knows is good enough for weather
    const last = await Location.getLastKnownPositionAsync().catch(() => null);
    return last ? { lat: round(last.coords.latitude), lon: round(last.coords.longitude) } : null;
  }
}

/** Opens the phone's settings page for this app (the only way out of "blocked" or "off"). */
export const openLocationSettings = () => {
  if (Platform.OS === 'android') Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => Linking.openSettings());
  else Linking.openSettings();
};

/**
 * Location permission and position. `request()` asks for permission and, on Android, shows the
 * system dialog that switches location on, so one tap on "Turn on location" does everything.
 */
export function useDeviceLocation() {
  const [state, setState] = useState<LocationState>('unknown');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await readState();
      setState(s);
      if (s === 'on') setCoords(await readPosition());
      else setCoords(null);
    } catch {
      setState('ask');
    }
  }, []);

  useEffect(() => {
    refresh();
    // coming back from the phone's settings: pick up what changed
    const sub = AppState.addEventListener('change', (a) => { if (a === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);

  const request = useCallback(async () => {
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setState(perm.canAskAgain === false ? 'blocked' : 'ask');
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        // Android: the system "turn on location" dialog; iOS has no such dialog
        await Location.enableNetworkProviderAsync().catch(() => {});
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return { state, coords, busy, request, refresh };
}
