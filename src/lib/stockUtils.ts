/**
 * Check if ALL direct-sale stock is depleted for a product.
 * When colors have option_stocks, colors are the PRIMARY stock source (options stock is ignored).
 * Returns true only when we have explicit stock data and everything is <= 0.
 * Returns false (meaning "in stock") when stock data shows positive values.
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
    // No stock tracking data = treat as depleted
    return true;
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

  // If colors had option_stocks data, and none had positive → depleted
  if (hasAnyStockData) return true;

  // Fallback: check color-level stock_quantity (no option_stocks)
  for (const color of colors) {
    if (color?.available_for_direct_sale === false) continue;
    if (color?.stock_quantity != null) {
      if (Number(color.stock_quantity) > 0) return false;
      hasAnyStockData = true;
    }
  }

  // If we found stock data and none had positive values → depleted
  // If no stock data found at all → treat as depleted
  return true;
}
