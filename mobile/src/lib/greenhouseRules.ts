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
