import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { GRACE_MS, Net, isOnline, offlineModeNow } from './modePolicy';

/*
 * Is the phone really online? "Connected to Wi-Fi" is not enough (a router with no internet, a captive portal), so the phone asks a
 * neutral public address that answers with an empty 204. It deliberately does NOT ask the CropManager server: a server that is asleep
 * or restarting must show the normal "cannot reach CropManager" screen, not throw every farmer into offline mode.
 * (Cloudflare's check address is used because it is reachable in more countries than Google's.)
 */
NetInfo.configure({
  reachabilityUrl: 'https://cp.cloudflare.com/generate_204',
  reachabilityTest: async (response) => response.status === 204,
  reachabilityLongTimeout: 15 * 1000, // while we believe we are offline
  reachabilityShortTimeout: 10 * 1000, // while we believe we are online
  reachabilityRequestTimeout: 10 * 1000,
  useNativeReachability: false,
});

export const toNet = (s: NetInfoState): Net => ({
  connected: !!s.isConnected,
  reachable: s.isInternetReachable ?? null,
  type: String(s.type || 'unknown'),
  expensive: (s.details as any)?.isConnectionExpensive ?? null,
});

/**
 * True while the phone has had no internet for a few seconds (and false again the moment it is back). The app then shows the offline
 * assistant only. Works before sign-in too: it needs nothing from the server.
 */
export function useOfflineMode(): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let since: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = (s: NetInfoState) => {
      if (isOnline(toNet(s))) {
        since = null;
        if (timer) clearTimeout(timer);
        timer = undefined;
        setOffline(false);
        return;
      }
      if (since === null) {
        since = Date.now();
        timer = setTimeout(() => setOffline(offlineModeNow(since, Date.now())), GRACE_MS);
      }
    };
    NetInfo.fetch().then(apply).catch(() => {});
    const unsub = NetInfo.addEventListener(apply);
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, []);
  return offline;
}
