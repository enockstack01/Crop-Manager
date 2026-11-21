/*
 * Recording fruit counts without a signal.
 *
 * A count recorded with no signal is kept on the phone: the form, and the photos as files on the phone. When the phone is back online the
 * queue sends them in the order they were recorded: first each photo is uploaded, then the count is saved with the photo addresses.
 *
 * Nothing is ever lost or saved twice:
 *   - a photo that was uploaded is remembered (its address replaces the file) before the count is sent, so a retry never uploads it again;
 *   - every count carries its own id (client_id), and the server returns the count it already saved instead of making a second one, so a reply
 *     lost on a bad connection followed by a retry is safe;
 *   - a count the server refuses (a plant that was deactivated since, a crop that was removed) is kept and marked failed with the reason,
 *     so the person can read it and delete or fix it, and one refused count never blocks the others;
 *   - a network error, an expired session or a server that is down stops the sending and keeps everything for the next try.
 *
 * This file holds the rules only, with no phone code, so it is tested on a computer (mobile/scripts/test-greenhouse.mjs). The phone's storage,
 * network and files are passed in as `deps` (see ghOutboxRuntime.ts).
 */
export type QueuedCount = {
  id: string; // the count's client_id
  user: string; // who recorded it: only that person's queue is sent while they are signed in
  farm: string; // the farm owner it belongs to ('' = the person's own farm)
  place: string; // for the list: "House A R3 P2"
  body: Record<string, any>; // the form as filled in, without the photos
  photos: string[]; // files on the phone, replaced one by one by their address on the server once uploaded
  recorded_at: string; // when the person recorded it
  status: 'waiting' | 'failed';
  error: string;
  attempts: number;
};

export type OutboxDeps = {
  load: () => Promise<QueuedCount[]>;
  save: (items: QueuedCount[]) => Promise<void>;
  upload: (uri: string) => Promise<string>; // a file on the phone -> its address on the server
  post: (farm: string, body: Record<string, any>) => Promise<unknown>;
  discard: (uri: string) => Promise<void>; // delete a file on the phone
  isNetwork: (e: unknown) => boolean; // the server was never reached
  statusOf: (e: unknown) => number | undefined;
  messageOf: (e: unknown) => string;
  now?: () => number;
};

export type FlushResult = { sent: number; failed: number; stopped: null | 'network' | 'auth' | 'server' };

/** A photo that is already on the server (the other kind is a file on this phone). */
export const isServerPhoto = (u: string) => /^\/uploads\//.test(u) || /^https?:\/\//i.test(u);

/** An id for a count that is made once, on the phone: letters and digits, 8 to 64 characters, as the server requires. */
export function newClientId(now = Date.now, rand = Math.random): string {
  const r = () => Math.floor(rand() * 36 ** 6).toString(36).padStart(6, '0');
  return `gh${now().toString(36)}${r()}${r()}`;
}

/** What the server tells us about a failed count, in words for the person (never a stack trace). */
const REFUSED = new Set([400, 403, 404, 409, 413, 415, 422]);

export function createOutbox(deps: OutboxDeps) {
  let items: QueuedCount[] | null = null;
  let flushing = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());
  const now = deps.now || Date.now;

  const ready = async (): Promise<QueuedCount[]> => {
    if (items === null) items = (await deps.load().catch(() => [])) || [];
    return items;
  };
  const persist = async () => { await deps.save(items || []); emit(); };

  return {
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },

    /** Everything waiting for this person, oldest first. */
    async list(user: string): Promise<QueuedCount[]> { return (await ready()).filter((q) => q.user === user); },

    /** Puts a count in the queue. Returns it, with the id it will be saved under. */
    async add(input: { id?: string; user: string; farm: string; place: string; body: Record<string, any>; photos: string[] }): Promise<QueuedCount> {
      const list = await ready();
      const q: QueuedCount = { id: input.id || newClientId(now), user: input.user, farm: input.farm || '', place: input.place, body: input.body, photos: [...input.photos], recorded_at: new Date(now()).toISOString(), status: 'waiting', error: '', attempts: 0 };
      list.push(q);
      await persist();
      return q;
    },

    /** Takes a count out of the queue, with its photos on the phone. */
    async remove(id: string) {
      const list = await ready();
      const q = list.find((x) => x.id === id);
      if (!q) return;
      items = list.filter((x) => x.id !== id);
      for (const p of q.photos) if (!isServerPhoto(p)) await deps.discard(p).catch(() => {});
      await persist();
    },

    /** A failed count is tried again (for example after the plant was reactivated). */
    async retry(id: string) {
      const q = (await ready()).find((x) => x.id === id);
      if (!q) return;
      q.status = 'waiting';
      q.error = '';
      await persist();
    },

    /** Sends this person's waiting counts, one after another. Stops at the first sign that the server cannot be reached. */
    async flush(user: string): Promise<FlushResult> {
      const out: FlushResult = { sent: 0, failed: 0, stopped: null };
      if (flushing) return out;
      flushing = true;
      try {
        for (;;) {
          const q = (await ready()).find((x) => x.user === user && x.status === 'waiting');
          if (!q) break;
          const stop = await sendOne(q, out);
          if (stop) { out.stopped = stop; break; }
        }
      } finally {
        flushing = false;
        emit();
      }
      return out;
    },

    isFlushing: () => flushing,
  };

  /** Returns why sending must stop, or null to go on with the next count. */
  async function sendOne(q: QueuedCount, out: FlushResult): Promise<FlushResult['stopped']> {
    const refuse = async (e: unknown) => { q.status = 'failed'; q.error = deps.messageOf(e) || 'The server did not accept this count.'; out.failed += 1; await persist(); };
    const trouble = async (e: unknown): Promise<FlushResult['stopped'] | 'refused'> => {
      if (deps.isNetwork(e)) return 'network';
      const s = deps.statusOf(e);
      if (s === 401) return 'auth';
      if (s !== undefined && REFUSED.has(s)) { await refuse(e); return 'refused'; }
      q.attempts += 1; // a server that is down or too busy (5xx, 429): try again later
      await persist();
      return 'server';
    };
    // 1. the photos, one by one; each uploaded photo is remembered at once
    for (let i = 0; i < q.photos.length; i += 1) {
      const p = q.photos[i];
      if (isServerPhoto(p)) continue;
      try {
        const url = await deps.upload(p);
        q.photos[i] = url;
        await persist();
        await deps.discard(p).catch(() => {});
      } catch (e) {
        const r = await trouble(e);
        return r === 'refused' ? null : r;
      }
    }
    // 2. the count, with its own id: sent twice, it is saved once
    try {
      await deps.post(q.farm, { ...q.body, photo_urls: q.photos, client_id: q.id, recorded_at: q.recorded_at });
      items = (items || []).filter((x) => x.id !== q.id);
      out.sent += 1;
      await persist();
      return null;
    } catch (e) {
      const r = await trouble(e);
      return r === 'refused' ? null : r;
    }
  }
}
