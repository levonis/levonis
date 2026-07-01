import { createContext, useContext } from 'react';
import { Language, TranslationKeys } from './types';
import { ar } from './ar';

export type { Language, TranslationKeys };

// Only Arabic (the default UI language for this app) is bundled statically.
// English and Kurdish packs are lazy-loaded on demand via ensureLanguageLoaded()
// so users who never switch language don't pay the ~150KB cost of the other
// two packs on first paint.
const translations: Partial<Record<Language, TranslationKeys>> = { ar };
const inflight: Partial<Record<Language, Promise<void>>> = {};

export function ensureLanguageLoaded(lang: Language): Promise<void> {
  if (translations[lang]) return Promise.resolve();
  const existing = inflight[lang];
  if (existing) return existing;
  const loader: Promise<{ default?: TranslationKeys } & Record<string, unknown>> =
    lang === 'en'
      ? import('./en').then((m) => m as any)
      : lang === 'ku'
        ? import('./ku').then((m) => m as any)
        : Promise.resolve({} as any);
  const p = loader
    .then((mod: any) => {
      // Both files export a named binding (`en` / `ku`).
      const pack = (mod?.[lang] ?? mod?.default) as TranslationKeys | undefined;
      if (pack) translations[lang] = pack;
    })
    .catch((err) => {
      console.error(`[i18n] failed to load language pack: ${lang}`, err);
    })
    .finally(() => {
      delete inflight[lang];
    });
  inflight[lang] = p;
  return p;
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  ar: 'العربية',
  en: 'English',
  ku: 'کوردی سۆرانی',
};

export const RTL_LANGUAGES: Language[] = ['ar', 'ku'];

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof TranslationKeys, vars?: Record<string, string | number>) => string;
  dir: 'rtl' | 'ltr';
  isRtl: boolean;
}

export const LanguageContext = createContext<LanguageContextType>({
  language: 'ar',
  setLanguage: () => {},
  t: (key) => key,
  dir: 'rtl',
  isRtl: true,
});

export function getTranslation(lang: Language, key: keyof TranslationKeys, vars?: Record<string, string | number>): string {
  // Fall back to Arabic (always bundled) while the requested pack is loading.
  const pack = translations[lang] ?? translations.ar;
  let text = pack?.[key] || translations.ar?.[key] || key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
  }
  return text;
}

export function getDirection(lang: Language): 'rtl' | 'ltr' {
  return RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr';
}

export function getSavedLanguage(): Language {
  const saved = localStorage.getItem('app-language') as Language;
  if (saved && ['ar', 'en', 'ku'].includes(saved)) return saved;
  return 'ar';
}

export function saveLanguage(lang: Language) {
  localStorage.setItem('app-language', lang);
}

export const useLanguage = () => useContext(LanguageContext);
