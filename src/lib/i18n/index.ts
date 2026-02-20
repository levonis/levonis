import { createContext, useContext } from 'react';
import { Language, TranslationKeys } from './types';
import { ar } from './ar';
import { en } from './en';
import { ku } from './ku';

export type { Language, TranslationKeys };

const translations: Record<Language, TranslationKeys> = { ar, en, ku };

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
  let text = translations[lang]?.[key] || translations.ar[key] || key;
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
