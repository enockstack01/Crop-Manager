import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  { code: 'ar', label: 'العربية' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'pt', label: 'Português' },
  { code: 'zh', label: '中文' },
] as const;
/** right-to-left scripts: the layout flips after the app is restarted */
export const RTL = ['ar'];
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
  // Android reads the reading direction at start-up, so the flip shows after the next restart
  const rtl = RTL.includes(code);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }
  i18n.changeLanguage(code);
}

export default i18n;
