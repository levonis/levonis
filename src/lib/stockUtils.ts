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
  const options = Array.isArray(product.options) ? product.options
    : Array.isArray(product.product_options) ? product.product_options
    : [];
  const hasOptions = options.length > 0;

  // Products WITHOUT variants (no colors, no options): check direct_stock
  if (!hasColors && !hasOptions) {
    if (product.direct_stock != null) {
      return Number(product.direct_stock) <= 0;
    }
    // No stock tracking data = treat as depleted
    return true;
  }

  // Products WITH colors: check option_stocks across direct-sale-eligible colors only
  if (hasColors) {
    let hasAnyStockData = false;

    for (const color of colors) {
      if (color?.available_for_direct_sale === false) continue;
      const stocks = color?.option_stocks;
      if (stocks && typeof stocks === 'object' && Object.keys(stocks).length > 0) {
        hasAnyStockData = true;
        const hasPositive = Object.values(stocks).some((v) => Number(v) > 0);
        if (hasPositive) return false;
      }
    }
    if (hasAnyStockData) return true;

    // Fallback: check color-level stock_quantity
    for (const color of colors) {
      if (color?.available_for_direct_sale === false) continue;
      if (color?.stock_quantity != null) {
        if (Number(color.stock_quantity) > 0) return false;
        hasAnyStockData = true;
      }
    }
    if (hasAnyStockData) return true;
  }

  // Products with options (no colors or colors had no stock data): check option-level stock
  if (hasOptions) {
    let hasAnyStockData = false;
    for (const opt of options) {
      if ((opt?.available_for_direct_sale ?? true) === false) continue;
      if (opt?.stock_quantity != null) {
        hasAnyStockData = true;
        if (Number(opt.stock_quantity) > 0) return false;
      }
    }
    if (hasAnyStockData) return true;
  }

  // No stock data found at all → treat as depleted
  return true;
}
