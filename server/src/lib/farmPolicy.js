/*
 * What a data collector may do on the farm manager's farm. One place, one rule set, tested on its own (scripts/test-farmteam.mjs).
 *
 *   The farm manager        owns the farm's records: everything, including finances, reports, the calendar and the assistant.
 *   A data collector        records field work into the manager's farm, tagged with their name, and works from a simpler dashboard:
 *                           today's entries, buttons to record, their open tasks, the fields that need a check, their own recent entries.
 *                           They cannot see finances, reports, the calendar or the assistant; cannot delete records, change the farm
 *                           profile or edit a colleague's entries; and cannot manage the team.
 *
 * `collectorMayCall(method, path)` answers for the API path below /api (for example 'field-activities/64f...'). Whether the entry being edited
 * is the collector's own is checked where the record is loaded (lib/crudController.js).
 */

/** The records a data collector enters: the field work. */
export const OPERATIONAL = [
  'planting-records', 'field-activities', 'irrigation-records', 'fertilizer-applications',
  'crop-protection-records', 'crop-scouting-records', 'harvest-records',
];
/** The farm's set-up, which a collector reads to choose a field, a crop or a season but does not change. */
export const REFERENCE = ['farms', 'fields', 'crops', 'crop-varieties', 'seasons', 'crop-cycles'];

const READ = new Set(['GET', 'HEAD']);
const WRITE = new Set(['POST', 'PUT', 'PATCH']);

const NO = (why) => ({ ok: false, why });
const YES = { ok: true, why: '' };

export function collectorMayCall(method, path) {
  const m = String(method || 'GET').toUpperCase();
  const parts = String(path || '').split('?')[0].split('/').filter(Boolean);
  const first = parts[0] || '';
  const rest = parts.slice(1).join('/');

  if (m === 'DELETE') return first === 'greenhouse' ? YES : NO('A data collector cannot delete records. Ask the farm manager.'); // the greenhouse routes have their own rules

  if (first === 'greenhouse') return YES; // the greenhouse tab decides by role (plan, recording, freezing a plant; no disease details, layout or team)
  if (first === 'uploads') return m === 'POST' || READ.has(m) ? YES : NO('Not allowed.');
  if (first === 'weather') return READ.has(m) ? YES : NO('Not allowed.');
  if (first === 'notifications') return YES; // their own notifications (the server answers for the person, not for the farm)

  if (first === 'dashboard') return READ.has(m) && rest === 'collector' ? YES : NO('Your dashboard is the field-work page.');
  if (first === 'tasks') return READ.has(m) || m === 'PUT' || m === 'PATCH' ? YES : NO('Only the farm manager creates tasks.'); // the task handler limits edits to marking their own tasks done

  if (OPERATIONAL.includes(first)) return READ.has(m) || WRITE.has(m) ? YES : NO('Not allowed.');
  if (REFERENCE.includes(first)) return READ.has(m) ? YES : NO('Only the farm manager changes the farm\'s set-up.');

  if (['expenses', 'sales'].includes(first)) return NO('Finances are for the farm manager.');
  if (['export', 'reports'].includes(first)) return NO('Reports and exports are for the farm manager.');
  if (first === 'calendar') return NO('The calendar is for the farm manager.');
  if (first === 'ai') return NO('The assistant is for the farm manager.');
  if (first === 'team') return NO('Only the farm manager manages the team.');
  return NO('This is for the farm manager.');
}

/** Whether a record in the farm belongs to this collector (they entered it): the only records they may edit. */
export const isOwnEntry = (doc, actorId) => !!doc && !!actorId && doc.recorded_by === actorId;
