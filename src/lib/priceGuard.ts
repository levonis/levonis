/**
 * Price Guard Utility
 * Ensures product prices are always displayed in IQD.
 * If a product has price_usd and the stored IQD price appears stale
 * (doesn't match current exchange rate), recalculates dynamically.
 */

/** Minimum expected IQD value — any price below this with a valid price_usd is suspicious */
const MIN_IQD_THRESHOLD = 500;

/**
 * Ensures a price value is in IQD by checking against price_usd and the current exchange rate.
 * If the price looks like it wasn't converted (matches USD value or is suspiciously low),
 * it recalculates from price_usd * rate.
 * 
 * @param priceIqd - The stored price (should already be in IQD)
 * @param priceUsd - The USD price of the product (if available)
 * @param usdToIqd - Current exchange rate
 * @returns Price guaranteed to be in IQD
 */
export function ensurePriceIqd(
  priceIqd: number,
  priceUsd: number | null | undefined,
  usdToIqd: number
): number {
  if (!priceIqd || priceIqd <= 0) return 0;
  if (!priceUsd || priceUsd <= 0 || !usdToIqd || usdToIqd <= 0) return priceIqd;

  // If price is suspiciously equal to or close to the USD value, it wasn't converted
  if (priceIqd <= priceUsd * 2) {
    return Math.round(priceUsd * usdToIqd);
  }

  // If price is below minimum IQD threshold, likely in USD
  if (priceIqd < MIN_IQD_THRESHOLD && priceUsd >= 1) {
    return Math.round(priceUsd * usdToIqd);
  }

  // Price looks like valid IQD — return as-is
  return priceIqd;
}

/**
 * Validates that a product's price fields are properly in IQD.
 * Returns corrected price fields if any were in USD.
 */
export function guardProductPrices(
  product: {
    price?: number | null;
    direct_sale_price?: number | null;
    sea_price?: number | null;
    air_price?: number | null;
    original_price?: number | null;
    price_usd?: number | null;
    original_price_usd?: number | null;
  },
  usdToIqd: number
): {
  price: number;
  direct_sale_price: number | null;
  sea_price: number | null;
  air_price: number | null;
  original_price: number | null;
} {
  const priceUsd = product.price_usd ?? null;
  const origUsd = product.original_price_usd ?? null;

  return {
    price: ensurePriceIqd(Number(product.price || 0), priceUsd, usdToIqd),
    direct_sale_price: product.direct_sale_price != null
      ? ensurePriceIqd(Number(product.direct_sale_price), priceUsd, usdToIqd)
      : null,
    sea_price: product.sea_price != null
      ? ensurePriceIqd(Number(product.sea_price), priceUsd, usdToIqd)
      : null,
    air_price: product.air_price != null
      ? ensurePriceIqd(Number(product.air_price), priceUsd, usdToIqd)
      : null,
    original_price: product.original_price != null
      ? ensurePriceIqd(Number(product.original_price), origUsd, usdToIqd)
      : null,
  };
}
