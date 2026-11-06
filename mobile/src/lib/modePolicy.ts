/*
 * Decisions behind offline mode and the automatic download of the offline assistant. Pure functions with no phone code, so they can be
 * tested on a computer (mobile/scripts/test-policy.mjs).
 */

export type Net = {
  connected: boolean; // the phone has a network
  reachable: boolean | null; // the internet answers (null = not known yet)
  type: string; // wifi, cellular, ethernet, none, unknown...
  expensive: boolean | null; // the network is metered (mobile data, hotspot)
};

/** The phone counts as online unless it is sure it is not: an unknown answer must not flash the offline screen. */
export const isOnline = (n: Pick<Net, 'connected' | 'reachable'>) => !!n.connected && n.reachable !== false;

/** How long the phone must stay offline before the app switches to offline mode, so a short dip in signal does not throw people out of what they are doing. */
export const GRACE_MS = 5000;

/**
 * Offline mode starts only after the phone has been offline for the whole grace period, and ends the moment it is online again.
 * `offlineSince` is when the phone last became offline (null while online).
 */
export function offlineModeNow(offlineSince: number | null, now: number, grace = GRACE_MS): boolean {
  return offlineSince !== null && now - offlineSince >= grace;
}

export type DownloadVerdict = { ok: boolean; reason: 'ok' | 'ready' | 'off' | 'offline' | 'mobile_data' | 'storage' | 'memory' };

/** Extra room kept free on top of the model itself, so the phone does not run out of storage. */
export const STORAGE_MARGIN = 400 * 1024 * 1024;

/**
 * The least memory a phone needs to run the offline assistant (a "6 GB" phone reports about 5.5 GB, a "4 GB" one about 3.7 GB).
 * Below this the 2.8 GB download would only waste the person's data and storage, because the model could not be loaded.
 */
export const MIN_MEMORY = 4.5 * 1024 * 1024 * 1024;

/**
 * Whether the offline assistant may start downloading by itself: only when it is not already there, the person has not turned the
 * automatic download off, the phone is online on an unmetered network (the file is about 2.8 GB), there is room for it and the phone has the memory to run it.
 * `allowMetered` is set when the person chose to download on mobile data.
 */
export function autoDownloadVerdict(i: { ready: boolean; enabled: boolean; net: Net; freeBytes: number | null; remainingBytes: number; allowMetered?: boolean; memoryBytes?: number | null }): DownloadVerdict {
  if (i.ready) return { ok: false, reason: 'ready' };
  if (i.memoryBytes != null && i.memoryBytes < MIN_MEMORY) return { ok: false, reason: 'memory' }; // known and too small: never worth downloading
  if (!i.enabled && !i.allowMetered) return { ok: false, reason: 'off' };
  if (!isOnline(i.net)) return { ok: false, reason: 'offline' };
  const metered = i.net.expensive === true || i.net.type === 'cellular' || (i.net.type !== 'wifi' && i.net.type !== 'ethernet' && i.net.expensive !== false);
  if (metered && !i.allowMetered) return { ok: false, reason: 'mobile_data' };
  if (i.freeBytes !== null && i.freeBytes < i.remainingBytes + STORAGE_MARGIN) return { ok: false, reason: 'storage' };
  return { ok: true, reason: 'ok' };
}
