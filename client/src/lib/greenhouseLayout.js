/*
 * The same position maths as the server (server/src/lib/greenhouse/layout.js), so the layout form can preview a house before it is saved.
 * A test on the server checks that both give the same answer.
 */
const r2 = (n) => Math.round(n * 100) / 100;

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

export const totalPositions = (h) => rowDefsOf(h).reduce((n, d) => n + d.plants * d.sub_rows, 0);

export function positionsOf(h) {
  const defs = rowDefsOf(h);
  const maxSlots = Math.max(1, ...defs.map((d) => d.start + d.plants));
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
        if (sub) z += (sub === 'A' ? -1 : 1) * rs * 0.2;
        if (h.pattern === 'zigzag') z += (p % 2 ? -1 : 1) * rs * 0.14;
        if (h.pattern === 'staggered' && row % 2 === 0) x += ps / 2;
        out.push({ row, sub: sub || null, plant: p, row_id: `R${row}${sub}`, plant_label: `P${p}`, x: r2(x), z: r2(z), state: 'active', latest: null });
      }
    }
  });
  return out;
}

/** The compass direction on the plan as a unit vector (x right, z down), given which way the top wall faces. */
export const northOnPlan = (deg) => { const a = ((deg || 0) * Math.PI) / 180; return [-Math.sin(a), -Math.cos(a)]; };

export const PATTERN_LABELS = { grid: 'Grid (straight rows)', zigzag: 'Zig-zag (plants alternate either side)', staggered: 'Staggered (every second row shifted)' };
