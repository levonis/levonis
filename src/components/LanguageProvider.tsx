import { useState, useCallback, useEffect, ReactNode } from 'react';
import { Language, LanguageContext, getTranslation, getDirection, getSavedLanguage, saveLanguage } from '@/lib/i18n';
import { TranslationKeys } from '@/lib/i18n/types';

export default function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getSavedLanguage);
  
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    saveLanguage(lang);
  }, []);

  const t = useCallback((key: keyof TranslationKeys, vars?: Record<string, string | number>) => {
    return getTranslation(language, key, vars);
  }, [language]);

  const dir = getDirection(language);
  const isRtl = dir === 'rtl';

  // Update document direction and lang
  useEffect(() => {
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', language === 'ku' ? 'ckb' : language);
  }, [language, dir]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
}
