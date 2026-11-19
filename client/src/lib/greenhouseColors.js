/* Colours for the greenhouse plan and 3D view. Kept apart from the 3D code so the plan loads without it. */
export const STATUS_COLOR = {
  match: '#2E7D32', close: '#7CB342', mismatch: '#C62828', inconclusive: '#F9A825', not_checked: '#546E7A', failed: '#EF6C00', none: '#B0BEC5', frozen: '#4FC3F7', inactive: '#616161',
};

export const HEALTH_COLOR = { healthy: '#2E7D32', sick: '#C62828', unsure: '#F9A825', not_checked: '#546E7A', none: '#B0BEC5' };

const hex = (n) => n.toString(16).padStart(2, '0');
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/** White to red for how much fruit, relative to the most on any plant. */
export function heatColor(n, max) {
  const t = max > 0 ? Math.min(1, n / max) : 0;
  const c = mix([0xff, 0xf3, 0xe0], [0xc6, 0x28, 0x28], t);
  return `#${hex(c[0])}${hex(c[1])}${hex(c[2])}`;
}

export function markerColor(p, colorBy, max) {
  if (p.state === 'inactive') return STATUS_COLOR.inactive; // uprooted
  if (p.state === 'frozen') return STATUS_COLOR.frozen; // left alone on purpose
  if (!p.latest) return STATUS_COLOR.none;
  if (colorBy === 'health') return HEALTH_COLOR[p.latest.health?.status || 'not_checked'] || HEALTH_COLOR.not_checked;
  return colorBy === 'fruit' ? heatColor(p.latest.recorded_count, max) : (STATUS_COLOR[p.latest.status] || STATUS_COLOR.not_checked);
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}
