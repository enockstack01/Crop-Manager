/*
 * Where every plant of a greenhouse stands (the same maths as the server and the website), so the phone can draw and preview a house.
 * No phone code in this file, so it can be tested on a computer. A test checks it gives the same places as the server.
 */
export type RowDef = { plants: number; start: number; sub_rows: 1 | 2 };
export type HouseShape = {
  length_m: number; width_m: number; rows: number; plants_per_row: number; row_defs?: Partial<RowDef>[]; pattern?: string;
  plant_spacing_m?: number | null; row_spacing_m?: number | null; orientation_deg?: number; door?: { wall: string; position: number; width_m: number } | null;
};
export type Position = { row: number; sub: string | null; plant: number; row_id: string; plant_label: string; x: number; z: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function rowDefsOf(h: HouseShape): RowDef[] {
  const out: RowDef[] = [];
  for (let i = 0; i < h.rows; i += 1) {
    const d: Partial<RowDef> = (h.row_defs && h.row_defs[i]) || {};
    out.push({
      plants: Number.isInteger(d.plants) && (d.plants as number) >= 0 ? (d.plants as number) : h.plants_per_row,
      start: Number.isInteger(d.start) && (d.start as number) >= 0 ? (d.start as number) : 0,
      sub_rows: d.sub_rows === 2 ? 2 : 1,
    });
  }
  return out;
}

export const totalPositions = (h: HouseShape) => rowDefsOf(h).reduce((n, d) => n + d.plants * d.sub_rows, 0);

export function positionsOf(h: HouseShape): Position[] {
  const defs = rowDefsOf(h);
  const maxSlots = Math.max(1, ...defs.map((d) => d.start + d.plants));
  const ps = h.plant_spacing_m || h.length_m / maxSlots;
  const rs = h.row_spacing_m || h.width_m / h.rows;
  const out: Position[] = [];
  defs.forEach((d, i) => {
    const row = i + 1;
    const subs = d.sub_rows === 2 ? ['A', 'B'] : [''];
    for (const sub of subs) {
      for (let p = 1; p <= d.plants; p += 1) {
        const slot = d.start + p;
        let x = h.length_m / 2 + (slot - (maxSlots + 1) / 2) * ps;
        let z = h.width_m / 2 + (row - (h.rows + 1) / 2) * rs;
        if (sub) z += (sub === 'A' ? -1 : 1) * rs * 0.2;
        if (h.pattern === 'zigzag') z += (p % 2 ? -1 : 1) * rs * 0.14;
        if (h.pattern === 'staggered' && row % 2 === 0) x += ps / 2;
        out.push({ row, sub: sub || null, plant: p, row_id: `R${row}${sub}`, plant_label: `P${p}`, x: r2(x), z: r2(z) });
      }
    }
  });
  return out;
}

/** The compass direction on the plan as a unit vector (x right, z down), given which way the top wall faces. */
export const northOnPlan = (deg: number): [number, number] => { const a = ((deg || 0) * Math.PI) / 180; return [-Math.sin(a), -Math.cos(a)]; };

export const PATTERNS: { value: string; label: string }[] = [
  { value: 'grid', label: 'Grid (straight rows)' },
  { value: 'zigzag', label: 'Zig-zag (plants alternate either side)' },
  { value: 'staggered', label: 'Staggered (every second row shifted)' },
];
export const WALLS: { value: string; label: string }[] = [
  { value: 'bottom', label: 'Bottom wall' }, { value: 'top', label: 'Top wall' }, { value: 'left', label: 'Left wall' }, { value: 'right', label: 'Right wall' },
];
