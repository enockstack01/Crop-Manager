import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { api, ApiError } from './api';

/*
 * Offline support for field work.
 *
 * - Connectivity comes from NetInfo and drives React Query's onlineManager, so
 *   queries pause offline and the cached (persisted) data stays on screen.
 * - Creates, edits and deletes made while offline (or when the server can't be
 *   reached) go into an outbox kept in AsyncStorage, and show up in the lists at
 *   once. A record created offline gets a temporary id ("local-…").
 * - When the phone is back online the outbox is replayed in order. Temporary ids
 *   are swapped for the real ones as records are created, so a field added to a
 *   farm that was itself created offline still lands on the right farm.
 * - A change the server refuses (e.g. a validation error) is dropped from the
 *   outbox and reported, so one bad record never blocks the rest.
 */

export type OutboxOp = {
  key: string; // unique id of this queued change
  method: 'post' | 'put' | 'delete';
  url: string; // e.g. /farms, /farms/<id>, /inventory-items/<id>/stock
  resource: string; // query-key prefix to refresh after syncing
  body?: any;
  tempId?: string; // for creates: the temporary id given to the new record
  user: string; // who made the change: only synced while that user is signed in
  at: number;
};

const KEY = 'offline-outbox-v1';
let queue: OutboxOp[] = [];
// temporary id -> server id; kept after syncing so edits made before the lists
// refresh (still using the temporary id) reach the right record
let idMap: Record<string, string> = {};
let loaded = false;
let syncing = false;
let currentUser: string | null = null; // signed in, with an API token available
let client: QueryClient | null = null;
const listeners = new Set<() => void>();
const failureListeners = new Set<(message: string) => void>();

const emit = () => listeners.forEach((fn) => fn());
const save = () => AsyncStorage.setItem(KEY, JSON.stringify({ queue, idMap })).catch(() => {});

export const isTempId = (id?: string | null) => typeof id === 'string' && id.startsWith('local-');
export const newTempId = () => `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export async function loadOutbox() {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) ({ queue = [], idMap = {} } = JSON.parse(raw));
  } catch {
    /* start empty */
  }
  loaded = true;
  emit();
}

const mine = () => queue.filter((q) => q.user === currentUser);

export function pendingChanges() {
  return mine().length;
}

export function onSyncFailure(fn: (message: string) => void) {
  failureListeners.add(fn);
  return () => {
    failureListeners.delete(fn);
  };
}

/** Queue a change. Edits/deletes of a record that is itself still waiting to be
 *  created are folded into that create instead of being sent separately. */
export function enqueue(op: Omit<OutboxOp, 'key' | 'at' | 'user'>) {
  const id = op.url.split('/')[2];
  if (isTempId(id) && op.url.split('/').length === 3) {
    const create = queue.find((q) => q.method === 'post' && q.tempId === id && q.user === currentUser);
    if (create) {
      if (op.method === 'put') create.body = { ...create.body, ...op.body };
      if (op.method === 'delete') queue = queue.filter((q) => q !== create && !q.url.includes(id));
      save();
      emit();
      return;
    }
  }
  queue.push({ ...op, key: newTempId(), user: currentUser || '', at: Date.now() });
  save();
  emit();
}

/** Replace temporary ids (in the url and in any string field of the body) with server ids. */
function resolveIds<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(/local-[a-z0-9]+-[a-z0-9]+/g, (m) => idMap[m] ?? m) as unknown as T;
  }
  if (Array.isArray(value)) return value.map(resolveIds) as unknown as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveIds(v)])) as T;
  }
  return value;
}

/** Send queued changes in order. Stops (keeping the rest) if the server can't be reached. */
export async function flushOutbox(qc: QueryClient) {
  if (syncing || !currentUser || !mine().length || !onlineManager.isOnline()) return;
  syncing = true;
  emit();
  const touched = new Set<string>();
  try {
    let op: OutboxOp | undefined;
    // in order, and only the signed-in user's changes (another user's wait for them)
    while ((op = queue.find((q) => q.user === currentUser))) {
      try {
        const url = resolveIds(op.url);
        const body = op.body === undefined ? undefined : resolveIds(op.body);
        const res = await api.request({ method: op.method, url, data: body });
        if (op.method === 'post' && op.tempId && res.data?.id) idMap[op.tempId] = res.data.id;
      } catch (e: any) {
        // still offline, or the session needs refreshing: keep everything and try again later
        if (e instanceof ApiError && (e.network || e.status === 401)) break;
        failureListeners.forEach((fn) => fn(e?.message || 'A change could not be saved'));
      }
      touched.add(op.resource);
      queue = queue.filter((q) => q !== op);
      save();
      emit();
    }
  } finally {
    syncing = false;
    save();
    emit();
    touched.forEach((r) => qc.invalidateQueries({ queryKey: [r] }));
    if (touched.size) qc.invalidateQueries({ queryKey: ['dashboard'] });
  }
}

/** Called with the user id once signed in and API calls carry a token (null on sign-out). */
export function setSyncUser(userId: string | null) {
  currentUser = userId;
  emit();
  if (userId && client) flushOutbox(client);
}

/** Wire NetInfo into React Query and replay the outbox whenever the phone comes back online. */
export function startOfflineSupport(qc: QueryClient) {
  client = qc;
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((s) => setOnline(!!s.isConnected && s.isInternetReachable !== false)),
  );
  const unsub = onlineManager.subscribe((online) => {
    emit();
    if (online) flushOutbox(qc);
  });
  loadOutbox().then(() => flushOutbox(qc));
  return unsub;
}

/** Live connectivity + outbox state for the offline banner. */
export function useOfflineState() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return { online: onlineManager.isOnline(), pending: mine().length, syncing };
}
