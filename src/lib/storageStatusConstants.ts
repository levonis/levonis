// Unified storage status filters for all 3 sources
// These must stay in sync across AllStoragePanel, OffersStoragePage, and OffersStorageSection

/** product_offer_purchases.purchase_status values to show in storage */
export const OFFER_PURCHASE_STATUSES = ['pending', 'purchased', 'shipping_requested', 'shipped'] as const;

/** competition_prizes.status values to show in storage */
export const PRIZE_STATUSES = ['pending', 'won', 'shipping_requested', 'shipped'] as const;

/** user_purchased_products.order_status values to show in storage */
export const PURCHASED_PRODUCT_STATUSES = ['not_ordered', 'ordered', 'shipping_requested', 'shipped'] as const;

/** Map raw DB statuses to display statuses for the UI */
export function normalizeStorageStatus(rawStatus: string): string {
  switch (rawStatus) {
    case 'purchased':
    case 'not_ordered':
    case 'won':
      return 'pending';
    case 'ordered':
      return 'shipping_requested';
    default:
      return rawStatus;
  }
}
