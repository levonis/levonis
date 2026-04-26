import { useLanguage } from '@/lib/i18n';

/**
 * Map app language code to a BCP-47 number locale.
 *  - en  → en-US (Latin digits, comma thousand separator)
 *  - ar  → ar-IQ (Arabic-Indic digits, Iraqi grouping)
 *  - ku  → ckb-IQ (Central Kurdish, Iraqi formatting)
 *
 * Centralized so number formatting stays consistent everywhere
 * (rewards, points history, wallet, store, plans, ...).
 */
export type AppLang = 'ar' | 'en' | 'ku';

export function numLocaleFor(lang: AppLang | string | undefined): string {
  switch (lang) {
    case 'en':
      return 'en-US';
    case 'ku':
      return 'ckb-IQ';
    case 'ar':
    default:
      return 'ar-IQ';
  }
}

/**
 * Format a number using the locale matching `lang`.
 * Safe for null / undefined / NaN inputs.
 */
export function formatLocaleNumber(
  value: number | string | null | undefined,
  lang: AppLang | string | undefined,
  options?: Intl.NumberFormatOptions,
): string {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value;
  if (!Number.isFinite(num as number)) return '0';
  return (num as number).toLocaleString(numLocaleFor(lang), options);
}

/** React hook returning a memoized formatter bound to the active language. */
export function useNumberFormat() {
  const { language } = useLanguage();
  const locale = numLocaleFor(language);
  return {
    locale,
    fmt: (v: number | string | null | undefined, options?: Intl.NumberFormatOptions) =>
      formatLocaleNumber(v, language, options),
  };
}
