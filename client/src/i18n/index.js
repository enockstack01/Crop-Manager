import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './locales/fr.json';
import rw from './locales/rw.json';
import sw from './locales/sw.json';

/*
 * Interface languages. The English text itself is the key (keySeparator / nsSeparator
 * off), so `t('Total Farms')` shows the French, Kinyarwanda or Swahili text when a
 * translation exists and the English otherwise. Shared components (page headers, form
 * labels, table columns, options, cards, buttons) translate the text they are given,
 * so most screens need no changes of their own. The same dictionaries are used by the
 * mobile app (mobile/src/i18n/locales).
 */
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'rw', label: 'Kinyarwanda' },
  { code: 'sw', label: 'Kiswahili' },
];
const CODES = LANGUAGES.map((l) => l.code);
const KEY = 'language';

function stored() {
  try {
    const v = localStorage.getItem(KEY);
    if (CODES.includes(v)) return v;
  } catch {
    /* storage unavailable */
  }
  const nav = (navigator.language || 'en').slice(0, 2);
  return CODES.includes(nav) ? nav : 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: {} },
    fr: { translation: fr },
    rw: { translation: rw },
    sw: { translation: sw },
  },
  lng: stored(),
  fallbackLng: 'en',
  keySeparator: false,
  nsSeparator: false,
  returnEmptyString: false,
  interpolation: { escapeValue: false },
});
document.documentElement.lang = i18n.language;

/** Translate English UI text (with optional {{placeholders}}). Non-strings pass through. */
export function t(text, vars) {
  if (typeof text !== 'string' || !text) return text;
  return i18n.t(text, vars);
}

export function setLanguage(code) {
  if (!CODES.includes(code) || code === i18n.language) return;
  try {
    localStorage.setItem(KEY, code);
  } catch {
    /* storage unavailable */
  }
  document.documentElement.lang = code;
  i18n.changeLanguage(code);
}

export default i18n;
