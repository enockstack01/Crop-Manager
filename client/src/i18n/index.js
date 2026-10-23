import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';
import rw from './locales/rw.json';
import sw from './locales/sw.json';
import ar from './locales/ar.json';
import de from './locales/de.json';
import es from './locales/es.json';
import hi from './locales/hi.json';
import pt from './locales/pt.json';
import zh from './locales/zh.json';

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
  { code: 'ar', label: 'العربية' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'pt', label: 'Português' },
  { code: 'zh', label: '中文' },
];
/** right-to-left scripts */
export const RTL = ['ar'];
const dirOf = (code) => (RTL.includes(code) ? 'rtl' : 'ltr');
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
    en: { translation: en }, // Agricoders house style: sentence case, British spelling (scripts/i18n)
    fr: { translation: fr },
    rw: { translation: rw },
    sw: { translation: sw },
    ar: { translation: ar },
    de: { translation: de },
    es: { translation: es },
    hi: { translation: hi },
    pt: { translation: pt },
    zh: { translation: zh },
  },
  lng: stored(),
  fallbackLng: 'en',
  keySeparator: false,
  nsSeparator: false,
  returnEmptyString: false,
  interpolation: { escapeValue: false },
});
document.documentElement.lang = i18n.language;
document.documentElement.dir = dirOf(i18n.language);

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
  document.documentElement.dir = dirOf(code);
  i18n.changeLanguage(code);
}

export default i18n;
