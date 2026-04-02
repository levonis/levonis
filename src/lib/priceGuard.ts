/**
 * Price Guard Utility
 * Ensures product prices are always displayed in IQD.
 * If a product has price_usd and the stored IQD price appears stale
 * (doesn't match current exchange rate), recalculates dynamically.
 */

/** Minimum expected IQD value — any price below this with a valid price_usd is suspicious */
const MIN_IQD_THRESHOLD = 500;

/**
 * Detects if a numeric value looks like it's in USD rather than IQD.
 * A value is likely USD if it's below the minimum IQD threshold
 * or suspiciously close to the known USD price.
 */
function looksLikeUsd(value: number, knownUsd: number | null | undefined): boolean {
  if (value < MIN_IQD_THRESHOLD) return true;
  if (knownUsd && knownUsd > 0 && value <= knownUsd * 2) return true;
  return false;
}

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

  // Only convert if the stored value looks like it's still in USD
  if (looksLikeUsd(priceIqd, priceUsd)) {
    return Math.round(priceUsd * usdToIqd);
  }

  // Price looks like valid IQD — return as-is
  return priceIqd;
}

/**
 * Converts a price adjustment value that may be in USD to IQD.
 * Option price_adjustments are sometimes stored in USD.
 * Detection: if the adjustment is below MIN_IQD_THRESHOLD it's clearly USD.
 * If a product's price_usd is provided, any adjustment smaller than price_usd * 2
 * is also treated as USD (since a genuine IQD adjustment would be far larger).
 */
export function ensureAdjustmentIqd(
  adjustment: number,
  usdToIqd: number,
  priceUsd?: number | null
): number {
  if (!adjustment || adjustment === 0) return 0;
  if (!usdToIqd || usdToIqd <= 0) return adjustment;
  
  const abs = Math.abs(adjustment);

  // Clearly USD — below minimum IQD threshold
  if (abs < MIN_IQD_THRESHOLD) {
    return Math.round(adjustment * usdToIqd);
  }

  // If we know the product's USD price, use it as a reference:
  // a genuine IQD adjustment would be >> price_usd, so if adjustment ≤ price_usd * 2
  // it's almost certainly still in USD.
  if (priceUsd && priceUsd > 0 && abs <= priceUsd * 2) {
    return Math.round(adjustment * usdToIqd);
  }

  return Math.round(adjustment);
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

/**
 * Calculates the correct IQD price for a cart item, applying USD→IQD conversion
 * to ALL price sources (product base, color override, sea/air prices).
 * Option price_adjustment is already in IQD and added directly.
 */
export function getGuardedCartItemPrice(
  item: {
    products?: any;
    custom_product_requests?: any;
    custom_request_id?: string | null;
    sale_type?: string;
    selected_color?: string;
    product_options?: any;
    shipping_option_index?: number | null;
    shipping_type?: string;
  },
  usdToIqd: number
): number {
  const product = item.products;
  if (!product) {
    return Number(item.custom_product_requests?.suggested_price || 0);
  }

  const isCustomRequest = !!item.custom_request_id;
  if (isCustomRequest) {
    return Number(item.custom_product_requests?.suggested_price || 0);
  }

  const isDirect = item.sale_type === 'direct';
  const priceUsd = product.price_usd ?? null;

  // 1. Start with base product price
  let price = ensurePriceIqd(Number(product.price || 0), priceUsd, usdToIqd);

  // 2. Override with sale-type-specific price
  if (isDirect && product.direct_sale_price != null) {
    price = ensurePriceIqd(Number(product.direct_sale_price), priceUsd, usdToIqd);
  } else if (!isDirect) {
    const shippingType = product.shipping_type || item.shipping_type;
    const seaPrice = product.sea_price;
    const airPrice = product.air_price;
    if (shippingType === 'sea' && seaPrice != null) {
      price = ensurePriceIqd(Number(seaPrice), priceUsd, usdToIqd);
    } else if (shippingType === 'air' && airPrice != null) {
      price = ensurePriceIqd(Number(airPrice), priceUsd, usdToIqd);
    } else if (shippingType === 'both' && seaPrice != null && airPrice != null) {
      price = Math.min(
        ensurePriceIqd(Number(seaPrice), priceUsd, usdToIqd),
        ensurePriceIqd(Number(airPrice), priceUsd, usdToIqd)
      );
    }
  }

  // 3. Override with color-specific price (guard it too)
  const selColor = item.selected_color;
  if (selColor && product.colors) {
    const colorData = (product.colors as any[]).find(
      (c: any) => c.name === selColor || c.name_ar === selColor || c.hex_code === selColor
    );
    if (colorData) {
      if (isDirect && colorData.direct_sale_price != null) {
        price = ensurePriceIqd(Number(colorData.direct_sale_price), priceUsd, usdToIqd);
      } else if (colorData.price != null) {
        price = ensurePriceIqd(Number(colorData.price), priceUsd, usdToIqd);
      }
    }
  }

  // 4. Add option price adjustment (may be in USD for some products)
  const optAdj = item.product_options?.price_adjustment;
  if (optAdj) {
    price += ensureAdjustmentIqd(Number(optAdj), usdToIqd);
  }

  // 5. Add pre-order shipping adjustment
  const shippingIndex = item.shipping_option_index;
  const shippingOptions = product.pre_order_shipping_options;
  if (shippingIndex != null && Array.isArray(shippingOptions) && shippingOptions[shippingIndex]) {
    price += Number((shippingOptions[shippingIndex] as any).price_adjustment || 0);
  }

  // 6. Round to nearest 250 if enabled
  if (product.round_up_price === true) {
    price = Math.ceil(price / 250) * 250;
  }

  return price;
}
