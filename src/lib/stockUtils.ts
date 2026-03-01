/**
 * Check if ALL direct-sale stock is depleted for a product.
 * Returns true only when we have explicit stock data and everything is <= 0.
 * Returns false (meaning "in stock" / unlimited) when no stock data exists.
 */
export function isAllDirectStockDepleted(product: any): boolean {
  if (!product) return false;

  const colors = Array.isArray(product.colors) ? product.colors : [];
  const hasColors = colors.length > 0;

  // Products WITHOUT variants: check direct_stock
  if (!hasColors) {
    if (product.direct_stock != null) {
      return Number(product.direct_stock) <= 0;
    }
    return false; // no stock tracking = unlimited
  }

  // Products WITH colors: check option_stocks across direct-sale-eligible colors only
  let hasAnyStockData = false;

  for (const color of colors) {
    // Skip colors not available for direct sale
    if (color?.available_for_direct_sale === false) continue;

    const stocks = color?.option_stocks;
    if (stocks && typeof stocks === 'object' && Object.keys(stocks).length > 0) {
      hasAnyStockData = true;
      const hasPositive = Object.values(stocks).some((v) => Number(v) > 0);
      if (hasPositive) return false; // at least one option still in stock
    }
  }

  // If we found stock data and none had positive values → depleted
  return hasAnyStockData;
}
