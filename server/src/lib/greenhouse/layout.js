/*
 * Where every plant of a greenhouse stands. A greenhouse is a number of rows; each row has its own number of positions, may start
 * further along the house, and may hold two side-by-side sub rows (A and B). A position is named "<row id> <plant>", for example
 * "R3 P7", or "R3A P7" in a row with sub rows. The plan, the 3D view and the recording form all use these same names.
 *
 * Coordinates are in metres on the plan: x runs along the length of the house, z across its width (z = 0 is the top wall).
 */
export const MAX_PLANTS = 6000;
export const PATTERNS = ['grid', 'zigzag', 'staggered'];
export const STATES = ['active', 'frozen', 'inactive'];

const r2 = (n) => Math.round(n * 100) / 100;

/** One definition per row: how many positions, where it starts, and whether it has two sub rows. Houses made before row definitions get a plain grid. */
export function rowDefsOf(h) {
  const out = [];
  for (let i = 0; i < h.rows; i += 1) {
    const d = (h.row_defs && h.row_defs[i]) || {};
    out.push({
      plants: Number.isInteger(d.plants) && d.plants >= 0 ? d.plants : h.plants_per_row,
      start: Number.isInteger(d.start) && d.start >= 0 ? d.start : 0,
      sub_rows: d.sub_rows === 2 ? 2 : 1,
    });
  }
  return out;
}

export const rowIdFor = (row, sub) => `R${row}${sub || ''}`;
export const plantLabelFor = (plant) => `P${plant}`;
export const keyOf = (rowId, plantLabel) => `${rowId}|${plantLabel}`;

/** How many positions the house has in all. */
export const totalPositions = (h) => rowDefsOf(h).reduce((n, d) => n + d.plants * d.sub_rows, 0);

/** The widest row, counting where it starts: it sets the spacing along the house. */
const slots = (defs) => Math.max(1, ...defs.map((d) => d.start + d.plants));

/** Every position with its place on the plan. */
export function positionsOf(h) {
  const defs = rowDefsOf(h);
  const maxSlots = slots(defs);
  const ps = h.plant_spacing_m || h.length_m / maxSlots;
  const rs = h.row_spacing_m || h.width_m / h.rows;
  const out = [];
  defs.forEach((d, i) => {
    const row = i + 1;
    const subs = d.sub_rows === 2 ? ['A', 'B'] : [''];
    for (const sub of subs) {
      for (let p = 1; p <= d.plants; p += 1) {
        const slot = d.start + p;
        let x = h.length_m / 2 + (slot - (maxSlots + 1) / 2) * ps;
        let z = h.width_m / 2 + (row - (h.rows + 1) / 2) * rs;
        if (sub) z += (sub === 'A' ? -1 : 1) * rs * 0.2; // the two sub rows sit close together on the same line
        if (h.pattern === 'zigzag') z += (p % 2 ? -1 : 1) * rs * 0.14; // plants alternate either side of the line
        if (h.pattern === 'staggered' && row % 2 === 0) x += ps / 2; // every second row is shifted half a step
        out.push({ row, sub: sub || null, plant: p, row_id: rowIdFor(row, sub), plant_label: plantLabelFor(p), x: r2(x), z: r2(z) });
      }
    }
  });
  return out;
}

/** Splits "R3A" into { row: 3, sub: 'A' }, or null when it is not a row of this house. */
export function parseRowId(h, rowId) {
  const m = /^R(\d{1,3})([AB]?)$/.exec(String(rowId || '').trim().toUpperCase());
  if (!m) return null;
  const row = Number(m[1]);
  const d = rowDefsOf(h)[row - 1];
  if (!d) return null;
  const sub = m[2] || '';
  if (d.sub_rows === 2 ? !sub : !!sub) return null;
  return { row, sub: sub || null, def: d };
}

/** Whether a position exists in this house. */
export function hasPosition(h, rowId, plantLabel) {
  const r = parseRowId(h, rowId);
  const m = /^P(\d{1,4})$/.exec(String(plantLabel || '').trim().toUpperCase());
  return !!(r && m && Number(m[1]) >= 1 && Number(m[1]) <= r.def.plants);
}

/** Where the door is on the plan, for drawing it. */
export function doorOf(h) {
  if (!h.door) return null;
  const { wall, position, width_m: w } = h.door;
  const along = wall === 'top' || wall === 'bottom' ? h.length_m : h.width_m;
  const c = Math.min(Math.max(position, 0), 1) * along;
  return { wall, position, width_m: w, from: r2(Math.max(0, c - w / 2)), to: r2(Math.min(along, c + w / 2)) };
}
