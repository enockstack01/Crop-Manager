import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { Profile } from '../models/index.js';

/*
 * The public user ID shown to people and printed on reports: the word "Crop" followed by six digits
 * (10 characters, for example Crop482913). It is worked out from the system's own user id with a keyed hash,
 * so the same person always gets the same ID, it cannot be guessed back to the system id, and it is stored
 * (unique) the first time it is made. If two people ever land on the same digits, the next attempt is used.
 */
const PREFIX = 'Crop';
const secret = () => process.env.PUBLIC_ID_SECRET || env.clerkSecretKey || 'cropmanager';

/** The candidate ID for a user id on a given attempt (attempt 0 unless it collided). */
export function publicIdFor(userId, attempt = 0) {
  const h = crypto.createHmac('sha256', secret()).update(`${userId}:${attempt}`).digest();
  const n = h.readUIntBE(0, 6) % 1_000_000; // 48 bits, reduced to six digits
  return `${PREFIX}${String(n).padStart(6, '0')}`;
}

export const isPublicId = (v) => /^Crop\d{6}$/.test(String(v || ''));

/** Gives a profile its public ID (once). Returns the ID. */
export async function ensurePublicId(profile) {
  if (profile?.public_id) return profile.public_id;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const id = publicIdFor(profile.user_id, attempt);
    try {
      const r = await Profile.updateOne({ user_id: profile.user_id, $or: [{ public_id: { $exists: false } }, { public_id: null }] }, { $set: { public_id: id } });
      if (r.matchedCount === 0) {
        const fresh = await Profile.findOne({ user_id: profile.user_id }, 'public_id').lean();
        return fresh?.public_id || id;
      }
      return id;
    } catch (err) {
      if (err?.code !== 11000) throw err; // taken by someone else: try the next attempt
    }
  }
  throw new Error('Could not make a public ID');
}

/** Startup job: every existing profile without an ID gets one. Safe to run on every start. */
export async function assignMissingPublicIds() {
  const rows = await Profile.find({ $or: [{ public_id: { $exists: false } }, { public_id: null }] }, 'user_id public_id').lean();
  for (const p of rows) await ensurePublicId(p);
  if (rows.length) console.log(`[migrate] gave ${rows.length} profile(s) a public ID`);
}
