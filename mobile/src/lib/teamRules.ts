/*
 * The farm manager and the data collector on the phone: who may add, edit and delete what, and the small rules the Team screens share.
 * Pure functions with no phone code, so they are tested on a computer (mobile/scripts/test-team.mjs). The server enforces the same rules;
 * these only decide what to show.
 */
export type ProfileLike = { user_type?: string; user_id?: string } | null | undefined;

/** The records a data collector enters: the field work. */
export const COLLECTOR_RESOURCES = [
  'planting-records', 'field-activities', 'irrigation-records', 'fertilizer-applications',
  'crop-protection-records', 'crop-scouting-records', 'harvest-records',
];

export const isCollector = (p: ProfileLike) => p?.user_type === 'collector';

/** A collector adds entries of field work only. */
export const mayAdd = (p: ProfileLike, resource: string) => !isCollector(p) || COLLECTOR_RESOURCES.includes(resource);
/** A collector edits only the entries they recorded themselves. */
export const mayEdit = (p: ProfileLike, resource: string, row: { recorded_by?: string } | null | undefined) =>
  !isCollector(p) || (COLLECTOR_RESOURCES.includes(resource) && !!row?.recorded_by && row.recorded_by === p?.user_id);
/** A collector never deletes, and has no exports. */
export const mayDelete = (p: ProfileLike) => !isCollector(p);
export const mayExport = (p: ProfileLike) => !isCollector(p);

/** The screens a data collector can open (everything else is the farm manager's). */
export const COLLECTOR_ROUTES = [
  'dashboard', 'tasks', 'activities', 'scouting', 'irrigation', 'fertilizers', 'crop-protection', 'planting', 'harvest', 'greenhouse', 'weather', 'settings', 'more',
];
export const collectorMayOpen = (route: string) => COLLECTOR_ROUTES.includes(route);

/** How the Team screens label a member's status. */
export const MEMBER_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  active: { label: 'Active', tone: 'success' },
  invited: { label: 'Waiting for sign-in', tone: 'warning' },
  expired: { label: 'Invitation expired', tone: 'danger' },
  removed: { label: 'Removed', tone: 'neutral' },
};

/** What is wrong with the invitation form, in words for the person ('' when it can be sent). Mirrors the server's checks. */
export function inviteProblem(v: { name?: string; email?: string; phone?: string }): string {
  const name = String(v.name || '').trim();
  const email = String(v.email || '').trim();
  const phone = String(v.phone || '').trim();
  if (name.length < 2) return "Enter the collector's name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
  if (phone && !/^[+0-9 ()\-.]{5,30}$/.test(phone)) return 'The phone number may contain digits, spaces and + - ( ) only.';
  return '';
}

/** "2 hours ago", "yesterday", "on 2026-11-02": how long since something happened, as a translatable key and its values. */
export function agoParts(iso?: string | null, now = Date.now()): { key: string; n?: number; date?: string } | null {
  if (!iso) return null;
  const ms = now - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  const min = Math.round(ms / 60000);
  if (min < 2) return { key: 'just now' };
  if (min < 60) return { key: '{{n}} minutes ago', n: min };
  const h = Math.round(min / 60);
  if (h < 24) return { key: h === 1 ? '1 hour ago' : '{{n}} hours ago', n: h };
  const d = Math.round(h / 24);
  if (d < 14) return { key: d === 1 ? 'yesterday' : '{{n}} days ago', n: d };
  return { key: 'on {{date}}', date: new Date(iso).toISOString().slice(0, 10) };
}
