import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Paths } from 'expo-file-system';
import { autoDownloadVerdict, isOnline } from '../lib/modePolicy';
import { toNet } from '../lib/connectivity';
import { MODEL, downloadModel, modelStatus, deleteModel } from './assistant';

/*
 * One shared place that downloads the offline assistant, so the first-launch download, the "Offline assistant" screen and the offline
 * screen all show the same progress. The download starts by itself on Wi-Fi when there is room (see modePolicy), continues after the
 * connection drops or the app is closed (the file is kept in pieces), and can be stopped or switched off by the person.
 * Note: it runs while the app is open; Android may stop it when the app is closed, and it picks up again next time.
 */
const AUTO_KEY = 'offline-assistant-auto';

export type Phase = 'idle' | 'downloading' | 'paused' | 'ready' | 'waiting' | 'error';
export type DownloadState = { phase: Phase; have: number; total: number; reason: string; auto: boolean };

let state: DownloadState = { phase: 'idle', have: 0, total: MODEL.bytes, reason: '', auto: true };
const subs = new Set<() => void>();
let ctl: AbortController | null = null;
// taken synchronously before anything is awaited: two starts at the same moment (launch and the connection listener) must never both run
let running = false;

const set = (patch: Partial<DownloadState>) => {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
};
const fromDisk = (): Partial<DownloadState> => {
  const s = modelStatus();
  return { have: s.have, total: s.total, phase: s.state === 'ready' ? 'ready' : s.state === 'partial' ? 'paused' : 'idle' };
};

export const getDownloadState = () => state;
export const subscribeDownload = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** Reads what is on the phone and the saved choice for the automatic download. */
export async function initDownloadState() {
  let auto = true;
  try { auto = (await AsyncStorage.getItem(AUTO_KEY)) !== 'off'; } catch { /* default on */ }
  set({ ...fromDisk(), auto, reason: '' });
}

export async function setAutoDownload(on: boolean) {
  try { await AsyncStorage.setItem(AUTO_KEY, on ? 'on' : 'off'); } catch { /* not saved */ }
  set({ auto: on });
  if (on) autoStart();
}

/** Downloads now (also on mobile data when `allowMetered`, because the person chose to). */
export async function startDownload({ allowMetered = false }: { allowMetered?: boolean } = {}) {
  if (running) return;
  running = true;
  const v = await check(allowMetered).catch(() => null);
  if (!v || !v.ok) { running = false; if (v) set({ phase: v.reason === 'ready' ? 'ready' : 'waiting', reason: v.reason }); return; }
  ctl = new AbortController();
  set({ phase: 'downloading', reason: '', ...{ have: modelStatus().have } });
  try {
    await downloadModel({ signal: ctl.signal, onProgress: (have, total) => set({ have, total, phase: have >= total ? 'ready' : 'downloading' }) });
    set({ ...fromDisk(), reason: '' });
  } catch (e: any) {
    set({ ...fromDisk(), phase: e?.message === 'cancelled' ? 'paused' : 'error', reason: e?.message === 'cancelled' ? 'cancelled' : 'network' });
  } finally {
    ctl = null;
    running = false;
  }
}

/** Stops the download and the automatic one too, until the person starts it again. */
export async function cancelDownload() {
  try { await AsyncStorage.setItem(AUTO_KEY, 'off'); } catch { /* not saved */ }
  set({ auto: false });
  ctl?.abort();
}

export function removeModel() {
  ctl?.abort();
  deleteModel();
  set({ ...fromDisk(), reason: '' });
}

async function check(allowMetered: boolean) {
  const net = toNet(await NetInfo.fetch());
  const ds = (() => { try { return Paths.availableDiskSpace; } catch { return NaN; } })();
  const s = modelStatus();
  return autoDownloadVerdict({
    ready: s.state === 'ready', enabled: state.auto, net, allowMetered,
    freeBytes: Number.isFinite(ds) ? ds : null, remainingBytes: MODEL.bytes - s.have,
  });
}

/** Starts the download by itself when the policy allows it; otherwise records why it is waiting. */
export async function autoStart() {
  if (running) return;
  const v = await check(false);
  if (v.ok) startDownload();
  else set({ ...(v.reason === 'ready' ? fromDisk() : {}), reason: v.reason });
}

/** Mount once near the top of the app: starts the first-launch download and tries again whenever the connection changes. */
export function useAutoDownload() {
  useEffect(() => {
    let live = true;
    initDownloadState().then(() => { if (live) autoStart(); });
    const unsub = NetInfo.addEventListener((n) => {
      if (!live) return;
      // connection lost: end the attempt now (a request on a dead connection can hang for ever), it restarts when the connection is back
      if (!isOnline(toNet(n))) { ctl?.abort(); return; }
      autoStart();
    });
    return () => { live = false; unsub(); };
  }, []);
}

export function useModelDownload(): DownloadState {
  return useSyncExternalStore(subscribeDownload, getDownloadState, getDownloadState);
}
