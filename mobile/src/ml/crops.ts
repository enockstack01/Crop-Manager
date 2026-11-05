import i18n from '../i18n';

/** The crops the on-phone model can tell apart, named in the app's language (read from the class list and label file, no model code). */
const CLASSES: string[] = require('../../assets/model/classes.json').image;
const LABELS: { key: string; crop: string; names: Record<string, { crop: string }> }[] = require('../../assets/model/labels.json').labels;
const slug = (cls: string) => cls.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export function offlineCrops(lang = i18n.language): { value: string; label: string }[] {
  const byKey = new Map(LABELS.map((l) => [l.key, l]));
  const seen = new Map<string, string>();
  for (const c of CLASSES) {
    const l = byKey.get(slug(c));
    if (l && !seen.has(l.crop)) seen.set(l.crop, l.names?.[lang]?.crop || l.names?.en?.crop || l.crop);
  }
  return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}
