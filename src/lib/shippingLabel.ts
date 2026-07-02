import type { TranslationKeys } from './i18n/types';

/**
 * Translate dynamic per-product shipping option names that are stored in
 * Arabic in the cart / products (both legacy and current naming):
 *   - بحري / اقتصادي           → Economy
 *   - جوي  / سريع              → Express
 *   - بري  / قياسي             → Standard
 *   - مباشر / بيع مباشر         → Direct
 *   - مسبق / حجز مسبق / طلب مسبق → Preorder
 * Falls back to the original label if no keyword matches.
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

  if (norm.includes('بحري') || norm.includes('اقتصادي')) return t('shipping_opt_sea');
  if (norm.includes('جوي') || norm.includes('سريع')) return t('shipping_opt_air');
  if (norm.includes('بري') || norm.includes('قياسي')) return (t as any)('shipping_opt_land') || s;
  if (norm.includes('مباشر')) return t('shipping_opt_direct');
  if (norm.includes('مسبق')) return t('shipping_opt_preorder');

  // Unknown custom label — return as-is.
  return s;
}

/**
 * Classify a raw shipping option label into a coarse category used for
 * mixed-shipping validation in the cart. Handles both legacy Arabic naming
 * (بحري/جوي/بري) and the new user-facing naming (اقتصادي/سريع/قياسي).
 */
export function getShippingCategory(
  rawArabic: string | null | undefined,
): 'air' | 'sea' | 'land' | 'other' {
  if (!rawArabic) return 'other';
  const norm = rawArabic.replace(/[^\u0600-\u06FF\s]/g, '').trim();
  if (norm.includes('بحري') || norm.includes('اقتصادي')) return 'sea';
  if (norm.includes('جوي') || norm.includes('سريع')) return 'air';
  if (norm.includes('بري') || norm.includes('قياسي')) return 'land';
  return 'other';
}
