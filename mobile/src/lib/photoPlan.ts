/*
 * How big a photo is sent. Pure functions with no phone code, so they are tested on a computer (mobile/scripts/test-files.mjs).
 *
 * A modern phone camera makes 12 to 50 megapixel photos of 5 to 15 MB. Sending one as it is takes minutes on mobile data (the app looked
 * frozen, then timed out), and decoding it wastes memory. The assistant and the on-phone model need far less: 1600 pixels on the long side
 * shows every spot and lesion of a leaf, and the file shrinks to a few hundred KB.
 */
export const MAX_SIDE = 1600;
/** A file this large is re-compressed even when its pixel size is already small. */
export const MAX_BYTES = 3 * 1024 * 1024;

export type ShrinkPlan = { resize?: { width: number } | { height: number } } | null;

/** What to do with a photo: null = send as it is; otherwise resize (never enlarging) and/or re-compress to JPEG. */
export function planShrink(width?: number | null, height?: number | null, bytes?: number | null): ShrinkPlan {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (w > 0 && h > 0 && Math.max(w, h) > MAX_SIDE) return { resize: w >= h ? { width: MAX_SIDE } : { height: MAX_SIDE } };
  if ((bytes || 0) > MAX_BYTES) return {};
  return null;
}
