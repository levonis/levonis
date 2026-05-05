/**
 * Centralized helpers for deriving the cart's `sale_type`.
 *
 * Cart items can be linked to one of three sources:
 *   - `product_id`     → regular product
 *   - `bundle_id`      → bundle
 *   - `rf_offer_id`    → Random Filament offer
 *
 * Any of those items carry their own `sale_type` ('direct' | 'preorder').
 * Use these helpers everywhere instead of re-implementing the lookup,
 * so adding a new linkable entity in the future only requires touching
 * this file.
 */

export type SaleType = 'direct' | 'preorder';

interface SaleTypeCartItem {
  product_id?: string | null;
  bundle_id?: string | null;
  rf_offer_id?: string | null;
  sale_type?: string | null;
  // allow extra fields without type errors
  [key: string]: any;
}

/**
 * True if the item is linked to any sellable source (product / bundle /
 * random-filament offer). Gift / placeholder rows return false.
 */
export function isSaleTypeBearingItem(item: SaleTypeCartItem | null | undefined): boolean {
  if (!item) return false;
  return Boolean(item.product_id || item.bundle_id || item.rf_offer_id);
}

/**
 * Read the sale_type of a single item, normalized to 'direct' | 'preorder'.
 * Falls back to 'preorder' when missing.
 */
export function getItemSaleType(item: SaleTypeCartItem | null | undefined): SaleType {
  const raw = item?.sale_type;
  return raw === 'direct' ? 'direct' : 'preorder';
}

/**
 * Derive the cart-wide sale_type from a list of cart items.
 *
 * Policy when items carry mixed sale_types ('direct' + 'preorder'):
 *   - The **first bearer item** in the list wins (it's the oldest item
 *     in the cart since `items` is ordered by creation).
 *   - This keeps the cart in a single, predictable mode and matches the
 *     conflict guard in `useCart` (which blocks new additions of a
 *     different `sale_type` until the user clears the cart).
 *
 * Returns `null` when the cart is empty or no item carries a sellable link.
 */
export function deriveCartSaleType(
  items: ReadonlyArray<SaleTypeCartItem> | null | undefined,
): SaleType | null {
  if (!items || items.length === 0) return null;
  const bearer = items.find(isSaleTypeBearingItem);
  if (!bearer) return null;
  return getItemSaleType(bearer);
}

/**
 * Detect a sale_type conflict between the existing cart and a new item
 * being added. Returns null when there is no conflict.
 *
 * The "winner" is whatever `deriveCartSaleType` reports for the existing
 * cart — that's the sale_type the user must keep (or clear the cart).
 */
export interface SaleTypeConflict {
  /** The sale_type currently locked in by the cart's first bearer item. */
  existing: SaleType;
  /** The sale_type the caller tried to add. */
  incoming: SaleType;
  /** Human-readable Arabic message explaining the conflict + resolution. */
  messageAr: string;
}

const SALE_TYPE_LABEL_AR: Record<SaleType, string> = {
  direct: 'بيع مباشر',
  preorder: 'حجز مسبق',
};

export function detectSaleTypeConflict(
  existingItems: ReadonlyArray<SaleTypeCartItem> | null | undefined,
  incomingSaleType: SaleType,
): SaleTypeConflict | null {
  const existing = deriveCartSaleType(existingItems);
  if (!existing || existing === incomingSaleType) return null;
  return {
    existing,
    incoming: incomingSaleType,
    messageAr:
      `سلتك تحتوي على منتجات من نوع "${SALE_TYPE_LABEL_AR[existing]}"، ` +
      `ولا يمكن إضافة منتج من نوع "${SALE_TYPE_LABEL_AR[incomingSaleType]}" معها. ` +
      `الرجاء إكمال الطلب الحالي أو إفراغ السلة للمتابعة.`,
  };
}
