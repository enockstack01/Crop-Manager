import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager, QueryClient, useQueryClient } from '@tanstack/react-query';
import { Directory, File, Paths } from 'expo-file-system';
import { api, ApiError, getFarmOwner } from './api';
import { createOutbox, isServerPhoto, type FlushResult, type QueuedCount } from './ghOutbox';

/*
 * The phone side of recording without a signal: where the queue is kept (AsyncStorage), how photos and counts are sent, and when sending is
 * tried (the phone comes back online, the app is opened again, a minute passes while counts are waiting, or the person taps "Send now").
 * The rules are in ghOutbox.ts and are tested on a computer.
 */
const KEY = 'gh-outbox-v1';
const folder = () => new Directory(Paths.document, 'gh-outbox');

const box = createOutbox({
  load: async () => {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedCount[]) : [];
  },
  save: (items) => AsyncStorage.setItem(KEY, JSON.stringify(items)),
  upload: async (uri) => {
    const form = new FormData();
    form.append('file', { uri, type: 'image/jpeg', name: `photo-${Date.now()}.jpg` } as any);
    const { data } = await api.post('/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 });
    return data.url as string;
  },
  post: (farm, body) => api.post('/greenhouse/counts', body, { headers: { 'X-Farm-Owner': farm }, timeout: 150000 }),
  // only the copies this queue made are deleted: never a photo from the person's gallery
  discard: async (uri) => {
    try {
      if (!uri.includes('/gh-outbox/')) return;
      const f = new File(uri);
      if (f.exists) f.delete();
    } catch { /* a file that is already gone is fine */ }
  },
  isNetwork: (e) => e instanceof ApiError && e.network,
  statusOf: (e) => (e instanceof ApiError ? e.status : undefined),
  messageOf: (e) => (e instanceof Error ? e.message : ''),
});

let user: string | null = null;
export const setGhOutboxUser = (id: string | null) => { user = id; if (id) flushNow(); };
export const ghUser = () => user;

/**
 * A photo that exists only on this phone is copied into the app's own folder, so it is still there when the phone is back online (the camera's
 * cache can be cleared in between). If copying fails the original file is used: a photo is never lost to a failed copy.
 */
export function keepPhoto(uri: string): string {
  if (isServerPhoto(uri)) return uri;
  try {
    const dir = folder();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true } as any);
    const dest = new File(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
    new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

/** Puts a count in the queue (its local photos are copied into the app's folder). Returns the queued count. */
export async function queueCount(input: { id?: string; place: string; body: Record<string, any>; photos: string[] }): Promise<QueuedCount> {
  if (!user) throw new Error('Sign in to record fruit counts.');
  const q = await box.add({ id: input.id, user, farm: getFarmOwner() || '', place: input.place, body: input.body, photos: input.photos.map(keepPhoto) });
  return q;
}

export async function flushNow(): Promise<FlushResult> {
  if (!user || !onlineManager.isOnline()) return { sent: 0, failed: 0, stopped: 'network' };
  return box.flush(user);
}

/** Starts the automatic sending. Call once, with the app's query client. */
export function startGhOutbox(qc: QueryClient) {
  const sent = (r: FlushResult) => { if (r.sent) qc.invalidateQueries({ queryKey: ['greenhouse'] }); };
  const offOnline = onlineManager.subscribe((online) => { if (online) flushNow().then(sent); });
  const offApp = AppState.addEventListener('change', (s) => { if (s === 'active') flushNow().then(sent); });
  // a server that was busy or down is tried again every minute while counts are waiting
  const timer = setInterval(async () => { if (user && onlineManager.isOnline() && (await box.list(user)).some((q) => q.status === 'waiting')) flushNow().then(sent); }, 60_000);
  return () => { offOnline(); offApp.remove(); clearInterval(timer); };
}

/** The queue for the signed-in person, live, with what the screens need to show and act on it. */
export function useGhOutbox() {
  const qc = useQueryClient();
  const [items, setItems] = useState<QueuedCount[]>([]);
  const [sending, setSending] = useState(false);
  const refresh = useCallback(async () => {
    setItems(user ? await box.list(user) : []);
    setSending(box.isFlushing());
  }, []);
  useEffect(() => {
    refresh();
    const off = box.subscribe(refresh);
    const id = setInterval(refresh, 2000); // the signed-in user is set a moment after the app opens
    return () => { off(); clearInterval(id); };
  }, [refresh]);
  return {
    items,
    sending,
    waiting: items.filter((q) => q.status === 'waiting').length,
    failed: items.filter((q) => q.status === 'failed').length,
    sendNow: async () => { const r = await flushNow(); if (r.sent) qc.invalidateQueries({ queryKey: ['greenhouse'] }); await refresh(); return r; },
    remove: async (id: string) => { await box.remove(id); await refresh(); },
    retry: async (id: string) => { await box.retry(id); await refresh(); const r = await flushNow(); if (r.sent) qc.invalidateQueries({ queryKey: ['greenhouse'] }); await refresh(); },
  };
}
