import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

/*
 * A farmer who opens an organization referral link (cropmanager://join/<token> or
 * https://crop.agricoders.com/join/<token>) before signing in: the token is kept on the phone and
 * the app takes them to the join screen once they are signed in.
 */
const KEY = 'pending_join';
let current: string | null = null;
const listeners = new Set<(t: string | null) => void>();

const set = async (token: string | null) => {
  current = token;
  listeners.forEach((l) => l(token));
  try {
    if (token) await AsyncStorage.setItem(KEY, token);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the token stays in memory for this session */
  }
};

export const pendingJoin = { set, clear: () => set(null) };

/** Pulls the token out of a link, or null when it is some other link. */
export function tokenFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/join\/([A-Za-z0-9_-]{20,})/);
  return m ? m[1] : null;
}

/** Listens for referral links (app opened by a link, or a link opened while it runs). Call once at the root. */
export function usePendingJoin(): string | null {
  const [token, setToken] = useState<string | null>(current);
  useEffect(() => {
    listeners.add(setToken);
    AsyncStorage.getItem(KEY).then((v) => { if (v && !current) { current = v; setToken(v); } }).catch(() => {});
    Linking.getInitialURL().then((u) => { const tk = tokenFromUrl(u); if (tk) set(tk); }).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => { const tk = tokenFromUrl(url); if (tk) set(tk); });
    return () => { listeners.delete(setToken); sub.remove(); };
  }, []);
  return token;
}
