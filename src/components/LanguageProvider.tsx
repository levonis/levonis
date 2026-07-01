import { useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { Language, LanguageContext, getTranslation, getDirection, getSavedLanguage, saveLanguage, ensureLanguageLoaded } from '@/lib/i18n';
import { TranslationKeys } from '@/lib/i18n/types';

export default function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getSavedLanguage);
  // Bump on async language-pack arrival so consumers re-render with new strings.
  const [, setPackTick] = useState(0);

  const setLanguage = useCallback((lang: Language) => {
    // Kick off dynamic load (no-op if already loaded / bundled) then swap.
    ensureLanguageLoaded(lang).finally(() => {
      setLanguageState(lang);
      saveLanguage(lang);
      setPackTick((n) => n + 1);
    });
  }, []);

  // Load the initial (non-default) language pack if needed.
  useEffect(() => {
    let cancelled = false;
    ensureLanguageLoaded(language).then(() => {
      if (!cancelled) setPackTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

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

  // Memoize context value so unrelated re-renders don't cascade to every
  // consumer (LanguageContext sits at the top of the tree).
  const value = useMemo(
    () => ({ language, setLanguage, t, dir, isRtl }),
    [language, setLanguage, t, dir, isRtl],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
