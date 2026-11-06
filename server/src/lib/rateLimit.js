import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

/*
 * Rate limiting for every route. Counters can live in the server's memory (fine for one instance, lost on restart, not shared) or in
 * MongoDB, which every instance already uses: then a limit holds across restarts and across any number of instances behind a load balancer.
 *
 *   RATE_LIMIT_STORE=mongo | memory     (default: mongo in production, memory otherwise)
 *
 * The shared counter is one atomic update per limited request. If the database cannot be reached the request is let through
 * (and the failure is logged): a database hiccup must not lock every farmer out.
 */
const COLLECTION = 'ratelimits';

export class MongoRateLimitStore {
  constructor(prefix = '') {
    this.prefix = prefix;
    this.localKeys = true;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  get collection() {
    return mongoose.connection.collection(COLLECTION);
  }

  key(k) {
    return `${this.prefix}|${k}`;
  }

  async increment(key) {
    const now = new Date();
    const expires = new Date(now.getTime() + this.windowMs);
    // one atomic step: count on inside the window, start a new window when the old one has ended (or there is none yet)
    const update = [{
      $set: {
        hits: { $cond: [{ $gt: ['$expires_at', now] }, { $add: [{ $ifNull: ['$hits', 0] }, 1] }, 1] },
        expires_at: { $cond: [{ $gt: ['$expires_at', now] }, '$expires_at', expires] },
      },
    }];
    try {
      let doc;
      try {
        doc = await this.collection.findOneAndUpdate({ _id: this.key(key) }, update, { upsert: true, returnDocument: 'after' });
      } catch (err) {
        if (err?.code !== 11000) throw err; // two first requests created the counter at the same moment: the second just counts on
        doc = await this.collection.findOneAndUpdate({ _id: this.key(key) }, update, { returnDocument: 'after' });
      }
      const row = doc?.value ?? doc; // the driver returns the document itself or a { value } wrapper, depending on its version
      return { totalHits: row?.hits || 1, resetTime: row?.expires_at || expires };
    } catch (err) {
      console.error('[rate-limit] shared counter unavailable, letting the request through:', err.message);
      return { totalHits: 1, resetTime: expires };
    }
  }

  async decrement(key) {
    try { await this.collection.updateOne({ _id: this.key(key), hits: { $gt: 0 } }, { $inc: { hits: -1 } }); } catch { /* best effort */ }
  }

  async resetKey(key) {
    try { await this.collection.deleteOne({ _id: this.key(key) }); } catch { /* best effort */ }
  }
}

let indexReady = false;
/** Counters of ended windows are removed by the database itself (TTL index on expires_at). */
export function ensureRateLimitIndex() {
  if (indexReady || mongoose.connection.readyState !== 1) return;
  indexReady = true;
  mongoose.connection.collection(COLLECTION).createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }).catch((e) => console.error('[rate-limit] index:', e.message));
}

const useMongo = () => (process.env.RATE_LIMIT_STORE || (process.env.NODE_ENV === 'production' ? 'mongo' : 'memory')) === 'mongo';

let counter = 0;
/** express-rate-limit with the configured store. Each limiter gets its own key prefix so two limits never share a counter. */
export function limiter(options) {
  counter += 1;
  const base = { windowMs: 60_000, standardHeaders: true, legacyHeaders: false, ...options };
  if (!useMongo()) return rateLimit(base);
  ensureRateLimitIndex();
  mongoose.connection.once('connected', ensureRateLimitIndex);
  return rateLimit({ ...base, store: new MongoRateLimitStore(options.name || `l${counter}`) });
}
