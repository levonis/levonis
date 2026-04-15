import { useLanguage } from '@/lib/i18n';
import { useMemo } from 'react';

interface ProductLike {
  name_ar?: string;
  name_en?: string | null;
  name_ku?: string | null;
  description_ar?: string | null;
  description_en?: string | null;
  description_ku?: string | null;
  [key: string]: any;
}

/**
 * Returns localized name and description for a product based on current language.
 * Falls back to Arabic if translation is not available.
 */
export function useLocalizedProduct(product: ProductLike | null | undefined) {
  const { language } = useLanguage();

  return useMemo(() => {
    if (!product) return { name: '', description: '' };

    const name =
      language === 'en'
        ? product.name_en || product.name_ar || ''
        : language === 'ku'
          ? product.name_ku || product.name_ar || ''
          : product.name_ar || '';

    const description =
      language === 'en'
        ? product.description_en || product.description_ar || ''
        : language === 'ku'
          ? product.description_ku || product.description_ar || ''
          : product.description_ar || '';

    return { name, description };
  }, [product, language]);
}

/**
 * Inline helper (no hook) for use in loops/maps.
 */
export function getLocalizedField(
  product: ProductLike,
  field: 'name' | 'description',
  language: 'ar' | 'en' | 'ku'
): string {
  if (field === 'name') {
    if (language === 'en') return product.name_en || product.name_ar || '';
    if (language === 'ku') return product.name_ku || product.name_ar || '';
    return product.name_ar || '';
  }
  if (language === 'en') return product.description_en || product.description_ar || '';
  if (language === 'ku') return product.description_ku || product.description_ar || '';
  return product.description_ar || '';
}
