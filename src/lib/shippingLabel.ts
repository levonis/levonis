import type { TranslationKeys } from './i18n/types';

/**
 * Translate dynamic per-product shipping option names that are stored in
 * Arabic in the cart (e.g. "شحن بحري", "شحن جوي", "بيع مباشر", "طلب مسبق").
 * Falls back to the original Arabic label if no keyword matches.
 *
 * Pass the i18n `t` function from `useLanguage()`.
 */
export function translateShippingOption(
  rawArabic: string | null | undefined,
  t: (k: keyof TranslationKeys) => string,
): string {
  if (!rawArabic) return '';
  const s = rawArabic.trim();
  // Keep emojis/icons by stripping them for matching only.
  const norm = s.replace(/[^\u0600-\u06FF\s]/g, '').trim();

  if (norm.includes('بحري')) return t('shipping_opt_sea');
  if (norm.includes('جوي') || norm.includes('سريع')) return t('shipping_opt_air');
  if (norm.includes('مباشر')) return t('shipping_opt_direct');
  if (norm.includes('مسبق')) return t('shipping_opt_preorder');

  // Unknown custom label — return as-is.
  return s;
}

/**
 * Classify a raw shipping option label into a coarse category used for
 * mixed-shipping validation in the cart. Returns 'air' | 'sea' | 'other'.
 */
export function getShippingCategory(
  rawArabic: string | null | undefined,
): 'air' | 'sea' | 'other' {
  if (!rawArabic) return 'other';
  const norm = rawArabic.replace(/[^\u0600-\u06FF\s]/g, '').trim();
  if (norm.includes('بحري')) return 'sea';
  if (norm.includes('جوي') || norm.includes('سريع')) return 'air';
  return 'other';
}
