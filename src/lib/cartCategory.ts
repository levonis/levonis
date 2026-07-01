import { getShippingCategory } from './shippingLabel';

export type CartCategory =
  | 'gift'
  | 'random_filament'
  | 'offer'
  | 'bundle'
  | 'community'
  | 'direct'
  | 'preorder_air'
  | 'preorder_sea'
  | 'preorder_other';

export const CART_CATEGORY_LABELS_AR: Record<CartCategory, string> = {
  gift: 'الهدايا',
  random_filament: 'الفلمنت العشوائي',
  offer: 'العروض',
  bundle: 'البندل',
  community: 'طلبات المجتمع',
  direct: 'البيع المباشر',
  preorder_air: 'الحجز المسبق - شحن سريع',
  preorder_sea: 'الحجز المسبق - شحن اقتصادي',
  preorder_other: 'الحجز المسبق',
};

/**
 * Classify a cart item into one of the mutually-exclusive cart categories.
 * Order matters: gift / RF / offer / bundle / community win over the
 * sale_type + shipping classification.
 */
export function getCartItemCategory(item: any): CartCategory {
  if (!item) return 'preorder_other';
  if (item.is_gift) return 'gift';
  if (item.is_random_filament || item.rf_offer_id) return 'random_filament';
  if (item.offer_purchase_id || item.offer_purchase) return 'offer';
  if (item.bundle_id || item.product_bundles) return 'bundle';
  if (item.custom_request_id) return 'community';

  const saleType = (item.sale_type || item.products?.sale_type || 'preorder') as string;
  if (saleType === 'direct') return 'direct';

  const ship = getShippingCategory(item.shipping_option_name_ar);
  if (ship === 'air') return 'preorder_air';
  if (ship === 'sea') return 'preorder_sea';
  return 'preorder_other';
}

/**
 * Returns the set of distinct categories for the non-gift items in the cart.
 * Gifts are excluded so they can ride along with any other order.
 */
export function getCartCategories(items: any[]): Set<CartCategory> {
  const set = new Set<CartCategory>();
  for (const it of items || []) {
    set.add(getCartItemCategory(it));
  }
  return set;
}
