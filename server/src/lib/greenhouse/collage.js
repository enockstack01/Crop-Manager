import crypto from 'node:crypto';
import sharp from 'sharp';
import createHttpError from '../httpError.js';
import { storage } from '../storage.js';
import { counterConfigured, counterUrl } from './verify.js';

/*
 * One plant, many photos. The person takes as many photos as it needs to show every fruit once; the server joins them into one collage
 * and the collage is what is counted and checked for disease. Each photo keeps its own cell, so a fruit cannot be split between two cells.
 *
 * The cell is large (CELL_W x CELL_H): a fruit must keep enough pixels to be recognised. The counter is told the grid and counts cell by cell
 * at full resolution, then adds them up and draws every counted fruit on the collage (see vision-service/fruitcount/tiles.py).
 */
export const MAX_PHOTOS = 12;
export const CELL_W = 960;
export const CELL_H = 720;
const GUTTER = 3; // dark margin around each photo inside its cell

export const columnsFor = (n) => (n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4);

/** The photos joined in a grid, as one JPEG. A single photo is returned as it is. */
export async function buildCollage(photos, { cellW = CELL_W, cellH = CELL_H } = {}) {
  if (photos.length === 1) return { jpeg: photos[0], columns: 1, rows: 1, cell: null };
  const columns = columnsFor(photos.length);
  const rows = Math.ceil(photos.length / columns);
  const cells = await Promise.all(photos.map(async (bytes, i) => {
    let jpeg;
    try {
      jpeg = await sharp(bytes, { failOn: 'none' }).rotate().resize({ width: cellW - GUTTER * 2, height: cellH - GUTTER * 2, fit: 'contain', background: '#1f2a21' }).jpeg({ quality: 90 }).toBuffer();
    } catch {
      throw createHttpError(400, `Photo ${i + 1} could not be read. Retake it or choose another.`);
    }
    return { input: jpeg, left: (i % columns) * cellW + GUTTER, top: Math.floor(i / columns) * cellH + GUTTER };
  }));
  const jpeg = await sharp({ create: { width: columns * cellW, height: rows * cellH, channels: 3, background: '#1f2a21' } })
    .composite(cells).jpeg({ quality: 88 }).toBuffer();
  return { jpeg, columns, rows, cell: { w: cellW, h: cellH } };
}

/** Stores the collage under the farm owner's prefix and returns its address. */
export async function saveCollage(owner, jpeg) {
  const name = `${owner}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}-collage.jpg`;
  await storage.put(name, jpeg);
  return `/uploads/${name}`;
}

/** Asks the counter which photos show the same part of the plant. [] when it cannot say (not connected, or older counter). */
export async function overlapWarnings(photos) {
  if (photos.length < 2 || !counterConfigured()) return [];
  try {
    const form = new FormData();
    photos.forEach((b, i) => form.append('files', new Blob([b], { type: 'image/jpeg' }), `p${i + 1}.jpg`));
    const res = await fetch(`${counterUrl()}/overlap`, {
      method: 'POST', body: form, signal: AbortSignal.timeout(30_000),
      headers: process.env.FRUIT_COUNTER_TOKEN ? { 'X-Token': process.env.FRUIT_COUNTER_TOKEN } : {},
    });
    if (!res.ok) return [];
    const body = await res.json();
    return (body.pairs || []).map((p) => ({ a: p.a, b: p.b }));
  } catch {
    return [];
  }
}
