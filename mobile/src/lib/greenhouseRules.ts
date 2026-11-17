/*
 * Plain rules of the greenhouse tab with no phone code, so they can be tested on a computer (mobile/scripts/test-greenhouse.mjs).
 */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';

/** How each verdict looks and reads. */
export const VERDICTS: Record<string, { label: string; tone: Tone; icon: string }> = {
  match: { label: 'Matches', tone: 'success', icon: 'circle-check' },
  close: { label: 'Close', tone: 'info', icon: 'circle-check' },
  mismatch: { label: 'Does not match', tone: 'danger', icon: 'triangle-exclamation' },
  inconclusive: { label: 'Not sure', tone: 'warning', icon: 'circle-question' },
  not_checked: { label: 'Not checked', tone: 'neutral', icon: 'circle-minus' },
  failed: { label: 'Check failed', tone: 'warning', icon: 'plug-circle-xmark' },
};

export const COLOR_HEX: Record<string, string> = { red: '#C62828', orange: '#EF6C00', yellow: '#F9A825', purple: '#5E35B1', green: '#7CB342' };

/** Whether a count form can be sent, and what to tell the person if not (the same rules as the server). */
export function countProblem(v: { crop_id?: string; row_id?: string; recorded_count?: string | number; photo_url?: string | null }): string {
  if (!v.crop_id) return 'Choose the crop.';
  if (!String(v.row_id || '').trim()) return 'Enter the row ID (for example R3 or Row 12).';
  const raw = v.recorded_count;
  if (raw === '' || raw === undefined || raw === null || !Number.isInteger(Number(raw)) || Number(raw) < 0) return 'Enter the number of fruit as a whole number, 0 or more.';
  if (!v.photo_url) return 'Add a photo that shows the fruit on the plant.';
  return '';
}

/* ---- greenhouse plan colours (same as the website) ---- */
export const STATUS_COLOR: Record<string, string> = {
  match: '#2E7D32', close: '#7CB342', mismatch: '#C62828', inconclusive: '#F9A825', not_checked: '#546E7A', failed: '#EF6C00', none: '#B0BEC5',
};
const hex2 = (n: number) => n.toString(16).padStart(2, '0');

/** White to red for how much fruit, relative to the most on any plant. */
export function heatColor(n: number, max: number): string {
  const t = max > 0 ? Math.min(1, n / max) : 0;
  const from = [0xff, 0xf3, 0xe0];
  const to = [0xc6, 0x28, 0x28];
  const c = from.map((v, i) => Math.round(v + (to[i] - v) * t));
  return `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}`;
}

export function markerColor(p: { latest?: { recorded_count: number; status?: string } | null }, colorBy: 'status' | 'fruit', max: number): string {
  if (!p.latest) return STATUS_COLOR.none;
  return colorBy === 'fruit' ? heatColor(p.latest.recorded_count, max) : (STATUS_COLOR[p.latest.status || 'not_checked'] || STATUS_COLOR.not_checked);
}

/** What a greenhouse layout needs before it can be sent. Returns '' when it is fine, else the first thing missing. */
export function houseProblem(v: { name?: string; length_m?: any; width_m?: any; rows?: any; plants_per_row?: any }): string {
  if (!String(v.name || '').trim()) return 'Give the greenhouse a name, for example House 1.';
  const pos = (x: any) => Number.isFinite(Number(x)) && String(x).trim() !== '' && Number(x) > 0;
  if (!pos(v.length_m) || Number(v.length_m) > 500) return 'Enter the length of the greenhouse in metres (1 to 500).';
  if (!pos(v.width_m) || Number(v.width_m) > 200) return 'Enter the width of the greenhouse in metres (1 to 200).';
  const whole = (x: any, hi: number) => String(x).trim() !== '' && Number.isInteger(Number(x)) && Number(x) >= 1 && Number(x) <= hi;
  if (!whole(v.rows, 100)) return 'Enter the number of rows, from 1 to 100.';
  if (!whole(v.plants_per_row, 300)) return 'Enter the number of plants in each row, from 1 to 300.';
  if (Number(v.rows) * Number(v.plants_per_row) > 6000) return 'A greenhouse can hold at most 6000 plants in the layout. Split a very large house in two.';
  return '';
}
