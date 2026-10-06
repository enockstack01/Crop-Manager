import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import fr from './locales/fr.json';
import rw from './locales/rw.json';
import sw from './locales/sw.json';

/*
 * Interface languages — same setup and dictionaries as the web app
 * (client/src/i18n). The English text is the key, so `t('Total Farms')` shows the
 * translation when one exists and the English otherwise. Shared components translate
 * the text they are given, so most screens need no changes of their own.
 */
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'rw', label: 'Kinyarwanda' },
  { code: 'sw', label: 'Kiswahili' },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]['code'];
const CODES: string[] = LANGUAGES.map((l) => l.code);
const KEY = 'language';

function deviceLanguage(): string {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale || 'en';
    const code = loc.slice(0, 2);
    return CODES.includes(code) ? code : 'en';
  } catch {
    return 'en';
  }
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: {} },
    fr: { translation: fr },
    rw: { translation: rw },
    sw: { translation: sw },
  },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  keySeparator: false,
  nsSeparator: false,
  returnEmptyString: false,
  interpolation: { escapeValue: false },
});

// the language chosen earlier on this device (read once at start-up)
AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v && CODES.includes(v) && v !== i18n.language) i18n.changeLanguage(v);
  })
  .catch(() => {});

/** Translate English UI text (with optional {{placeholders}}). Non-strings pass through. */
export function t<T>(text: T, vars?: Record<string, unknown>): T {
  if (typeof text !== 'string' || !text) return text;
  return i18n.t(text, vars as any) as unknown as T;
}

export function setLanguage(code?: string | null) {
  if (!code || !CODES.includes(code) || code === i18n.language) return;
  AsyncStorage.setItem(KEY, code).catch(() => {});
  i18n.changeLanguage(code);
}

export default i18n;
