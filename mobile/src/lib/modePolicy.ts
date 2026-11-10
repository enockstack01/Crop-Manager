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

export type DownloadVerdict = { ok: boolean; reason: 'ok' | 'ready' | 'off' | 'offline' | 'mobile_data' | 'storage' | 'memory' | 'unsupported' };

/** Extra room kept free on top of the model itself, so the phone does not run out of storage. */
export const STORAGE_MARGIN = 400 * 1024 * 1024;

/**
 * The least memory a phone needs to run the offline assistant (a "3 GB" phone reports about 2.8 GB, a "2 GB" one about 1.8 GB).
 * Below this the 769 MB download would only waste the person's data and storage, because the model could not be loaded.
 */
export const MIN_MEMORY = 2.4 * 1024 * 1024 * 1024;

/**
 * The on-phone language model is built for 64-bit processors only (arm64-v8a on phones, x86_64 on emulators); its library has no 32-bit
 * version. `abis` is the list the phone reports (expo-device supportedCpuArchitectures): a phone that lists only 32-bit ones (armeabi-v7a,
 * armeabi, x86) cannot run it, even if its processor could, because its system is 32-bit. Unknown (null or empty) counts as supported, so
 * a phone is never refused on a guess. The leaf scan is a different, smaller library and works on 32-bit too.
 */
export function llmSupported(abis: readonly string[] | null | undefined): boolean {
  if (!abis || abis.length === 0) return true;
  return abis.some((a) => a === 'arm64-v8a' || a === 'x86_64' || a === 'arm64');
}

/**
 * Offline mode (the screen with only the offline assistant) takes over the app only on a phone that can run the assistant. A 32-bit phone
 * is never offered the assistant or its download: with no internet it keeps the normal app (its records, the leaf scan) and the online AI
 * works again when the connection returns.
 */
export const offlineModeApplies = (noInternet: boolean, canRunAssistant: boolean) => noInternet && canRunAssistant;

/**
 * Whether the offline assistant may start downloading by itself: only when it is not already there, the person has not turned the
 * automatic download off, the phone is online on an unmetered network (the file is about 770 MB), there is room for it and the phone has the memory to run it.
 * `allowMetered` is set when the person chose to download on mobile data.
 */
export function autoDownloadVerdict(i: { ready: boolean; enabled: boolean; net: Net; freeBytes: number | null; remainingBytes: number; allowMetered?: boolean; memoryBytes?: number | null; cpuAbis?: readonly string[] | null }): DownloadVerdict {
  if (i.ready) return { ok: false, reason: 'ready' };
  if (!llmSupported(i.cpuAbis)) return { ok: false, reason: 'unsupported' }; // no point downloading a model this phone cannot load
  if (i.memoryBytes != null && i.memoryBytes < MIN_MEMORY) return { ok: false, reason: 'memory' }; // known and too small: never worth downloading
  if (!i.enabled && !i.allowMetered) return { ok: false, reason: 'off' };
  if (!isOnline(i.net)) return { ok: false, reason: 'offline' };
  const metered = i.net.expensive === true || i.net.type === 'cellular' || (i.net.type !== 'wifi' && i.net.type !== 'ethernet' && i.net.expensive !== false);
  if (metered && !i.allowMetered) return { ok: false, reason: 'mobile_data' };
  if (i.freeBytes !== null && i.freeBytes < i.remainingBytes + STORAGE_MARGIN) return { ok: false, reason: 'storage' };
  return { ok: true, reason: 'ok' };
}

/**
 * Whether the offline tools page covers the whole app. A phone that has a saved, signed-in account keeps the normal app with no internet (records
 * and dashboards come from the copy on the phone, changes wait and are sent later), so the page covers it only when: the phone is offline, can
 * run the assistant and holds no saved account (`savedAccount` false; null = not read yet, never covers), or the person opened it themselves (`forced`).
 */
export const offlineTakeover = (noInternet: boolean, canRunAssistant: boolean, savedAccount: boolean | null, forced: boolean) =>
  forced || (noInternet && canRunAssistant && savedAccount === false);
