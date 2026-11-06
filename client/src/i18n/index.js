import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

// the other languages are separate files, fetched only when somebody uses them (about 90 KB each instead of 860 KB for everyone)
const LOADERS = {
  fr: () => import('./locales/fr.json'),
  rw: () => import('./locales/rw.json'),
  sw: () => import('./locales/sw.json'),
  ar: () => import('./locales/ar.json'),
  de: () => import('./locales/de.json'),
  es: () => import('./locales/es.json'),
  hi: () => import('./locales/hi.json'),
  pt: () => import('./locales/pt.json'),
  zh: () => import('./locales/zh.json'),
};

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
  },
  lng: stored(),
  fallbackLng: 'en',
  keySeparator: false,
  nsSeparator: false,
  returnEmptyString: false,
  interpolation: { escapeValue: false },
});
/** Fetches a language's texts once; English is already there. Never throws: a failed fetch leaves English showing. */
async function ensureLoaded(code) {
  if (code === 'en' || !LOADERS[code] || i18n.hasResourceBundle(code, 'translation')) return;
  try {
    const mod = await LOADERS[code]();
    i18n.addResourceBundle(code, 'translation', mod.default, true, true);
  } catch {
    /* offline or blocked: the page stays in English */
  }
}

/** Resolves when the language chosen at start-up is ready, so the first screen is never shown in English first. */
export const i18nReady = ensureLoaded(i18n.language).then(() => i18n.changeLanguage(i18n.language));

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
  ensureLoaded(code).then(() => i18n.changeLanguage(code));
}

export default i18n;
