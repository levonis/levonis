/**
 * Helper: detect whether a cart contains the Levo physical card product.
 * Uses `products.is_system_reserved` which is set only on the one reserved
 * card product (see migration 20260702035456).
 */
export function isLevoCardItem(item: any): boolean {
  return !!(item?.products?.is_system_reserved);
}

export function cartHasLevoCard(items: any[] | undefined | null): boolean {
  return !!items?.some(isLevoCardItem);
}

export function cartHasOnlyLevoCard(items: any[] | undefined | null): boolean {
  if (!items?.length) return false;
  return items.every(isLevoCardItem);
}

export function cartHasLevoCardWithOther(items: any[] | undefined | null): boolean {
  if (!items?.length) return false;
  return cartHasLevoCard(items) && items.some((i) => !isLevoCardItem(i));
}
