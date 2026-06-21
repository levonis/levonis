/**
 * Price Guard Utility
 * Ensures product prices are always displayed in IQD.
 * If a product has price_usd and the stored IQD price appears stale
 * (doesn't match current exchange rate), recalculates dynamically.
 */
import { supabase } from '@/integrations/supabase/client';

/** Minimum expected IQD value — any price below this with a valid price_usd is suspicious */
const MIN_IQD_THRESHOLD = 500;

/**
 * Fetches live direct-sale prices via the SECURITY DEFINER RPC.
 * Used because internal commission/shipping cost columns are no longer
 * readable client-side — the server computes the linked-COD direct-sale
 * price and returns only the final IQD value.
 */
export async function fetchLiveDirectSalePrices(
  productIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const ids = Array.from(new Set((productIds || []).filter(Boolean)));
  if (ids.length === 0) return out;
  try {
    const { data, error } = await (supabase as any).rpc(
      'compute_products_live_direct_sale_prices',
      { p_ids: ids }
    );
    if (error || !Array.isArray(data)) return out;
    for (const row of data as Array<{ product_id: string; direct_sale_price: number | null }>) {
      if (row?.product_id && row.direct_sale_price != null) {
        out.set(row.product_id, Number(row.direct_sale_price));
      }
    }
  } catch {
    // Non-fatal — caller falls back to stored direct_sale_price
  }
  return out;
}


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
    land_price?: number | null;
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
  land_price: number | null;
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
    land_price: product.land_price != null
      ? ensurePriceIqd(Number(product.land_price), priceUsd, usdToIqd)
      : null,
    original_price: product.original_price != null
      ? ensurePriceIqd(Number(product.original_price), origUsd, usdToIqd)
      : null,
  };
}

/**
 * Computes the live direct-sale price when `link_direct_commission_to_cod` is enabled.
 * The commission portion is derived from global COD settings applied to the live pre-order price,
 * so the returned value adjusts automatically when exchange rate / shipping / COD settings change.
 *
 * Returns null if the flag is not set or required inputs are missing — caller should fall back
 * to the stored `direct_sale_price`.
 */
export function computeLinkedDirectSalePrice(
  product: {
    link_direct_commission_to_cod?: boolean | null;
    has_pre_order?: boolean | null;
    shipping_type?: string | null;
    price_usd?: number | null;
    personal_delivery_cost?: number | null;
    referral_earnings_iqd?: number | null;
    commission_sea_iqd?: number | null;
    commission_air_iqd?: number | null;
    commission_land_iqd?: number | null;
    sea_price?: number | null;
    air_price?: number | null;
    land_price?: number | null;
    shipping_cost_iqd?: number | null;
    round_up_price?: boolean | null;
  },
  shippingSettings: { usd_to_iqd_rate: number } | null | undefined,
  codDefaults:
    | {
        type: 'percentage' | 'fixed';
        value: number;
        tiers?: Array<{
          min_amount: number;
          max_amount: number;
          cod_fee_type?: 'percentage' | 'fixed';
          cod_fee_value?: number;
        }>;
      }
    | null
    | undefined
): number | null {
  if (!product?.link_direct_commission_to_cod) return null;
  if (!shippingSettings || !codDefaults) return null;

  const priceUsd = Number(product.price_usd || 0);
  if (priceUsd <= 0) return null;

  const rate = Number(shippingSettings.usd_to_iqd_rate) || 0;
  if (rate <= 0) return null;

  const priceIqd = Math.round(priceUsd * rate);
  const pdc = Number(product.personal_delivery_cost || 0);
  const referral = Number(product.referral_earnings_iqd || 0);
  const seaCommission = Number(product.commission_sea_iqd || 0);
  const airCommission = Number(product.commission_air_iqd || 0);
  const landCommission = Number(product.commission_land_iqd || 0);

  const hasPreOrder = !!product.has_pre_order;
  const st: string = product.shipping_type || '';
  const tokens = st === 'both' ? ['sea', 'air'] : st.split(',').map((t) => t.trim()).filter(Boolean);
  const hasSea = tokens.includes('sea');
  const hasAir = tokens.includes('air');
  const hasLand = tokens.includes('land');

  // Use stored raw shipping cost (matches what admin form computed at save time)
  // rather than deriving from sea_price/air_price (which may be rounded up).
  const shippingCost = Number(product.shipping_cost_iqd || 0);

  // Pre-order commission preference: sea > air > land
  let preOrderCommissionAddon = 0;
  if (hasPreOrder) {
    if (hasSea) preOrderCommissionAddon = seaCommission;
    else if (hasAir) preOrderCommissionAddon = airCommission;
    else if (hasLand) preOrderCommissionAddon = landCommission;
  }

  // Pre-order base for the COD percentage (raw, unrounded — matches admin form logic)
  const preorderFinal = priceIqd + shippingCost + preOrderCommissionAddon + pdc + referral;

  // Pick the COD tier matching the pre-order amount; fall back to legacy default.
  let codType: 'percentage' | 'fixed' = codDefaults.type;
  let codValue: number = codDefaults.value;
  if (Array.isArray(codDefaults.tiers) && codDefaults.tiers.length > 0) {
    const tier = codDefaults.tiers.find(
      (t) =>
        preorderFinal >= Number(t.min_amount || 0) &&
        preorderFinal <= Number(t.max_amount || 0)
    );
    if (tier && tier.cod_fee_value != null) {
      codType = (tier.cod_fee_type ?? 'percentage') as 'percentage' | 'fixed';
      codValue = Number(tier.cod_fee_value) || 0;
    }
  }

  // If COD value is 0 (e.g. anon user can't read settings due to RLS), don't override stored price
  if (!codValue || codValue <= 0) return null;

  let directPortion: number;
  if (codType === 'fixed') {
    directPortion = Math.ceil(codValue);
  } else {
    directPortion = Math.ceil((preorderFinal * codValue) / 100);
  }

  let total = priceIqd + shippingCost + preOrderCommissionAddon + directPortion + pdc + referral;

  if (product.round_up_price) {
    total = Math.ceil(total / 250) * 250;
  }
  return total;
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
  usdToIqd: number,
  codDefaults?: { type: 'percentage' | 'fixed'; value: number } | null,
  livePriceMap?: Map<string, number> | null
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
  if (isDirect) {
    // If product is linked to global COD %, prefer the server-computed live price
    // (via fetchLiveDirectSalePrices). Internal commission/shipping cost columns are
    // hidden from clients, so the local computeLinkedDirectSalePrice fallback is only
    // used when those fields are still readable (e.g. admin context / tests).
    if (product.link_direct_commission_to_cod) {
      const fromMap = livePriceMap?.get(product.id);
      if (fromMap != null && fromMap > 0) {
        price = fromMap;
      } else {
        // Local fallback is only safe when the internal cost columns are
        // readable (admin/test contexts). On the public client they're hidden
        // by column-level RLS, so `shipping_cost_iqd` is `undefined`. In that
        // case treat the stored `direct_sale_price` as authoritative — it is
        // kept in sync by the same admin save flow that powers the RPC.
        const costsReadable = (product as any).shipping_cost_iqd !== undefined;
        const liveDirect = costsReadable && codDefaults
          ? computeLinkedDirectSalePrice(
              product as any,
              { usd_to_iqd_rate: usdToIqd } as any,
              codDefaults,
            )
          : null;
        if (liveDirect != null) {
          price = liveDirect;
        } else if (product.direct_sale_price != null) {
          price = ensurePriceIqd(Number(product.direct_sale_price), priceUsd, usdToIqd);
        } else {
          return 0;
        }
      }
    } else if (product.direct_sale_price != null) {

      price = ensurePriceIqd(Number(product.direct_sale_price), priceUsd, usdToIqd);
    }
  } else if (!isDirect) {
    const productShippingType = product.shipping_type || '';
    const seaPrice = product.sea_price;
    const airPrice = product.air_price;
    const landPrice = (product as any).land_price;
    // Token list (supports legacy 'both' and new comma-separated)
    const tokens: string[] = (productShippingType === 'both' ? 'sea,air' : productShippingType)
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);
    const priceFor = (t: string): number | null => {
      if (t === 'sea' && seaPrice != null) return ensurePriceIqd(Number(seaPrice), priceUsd, usdToIqd);
      if (t === 'air' && airPrice != null) return ensurePriceIqd(Number(airPrice), priceUsd, usdToIqd);
      if (t === 'land' && landPrice != null) return ensurePriceIqd(Number(landPrice), priceUsd, usdToIqd);
      return null;
    };

    // Prefer the user's explicit choice persisted on the cart item.
    const itemShippingType = (item.shipping_type || '').trim();
    const chosenToken = itemShippingType && ['sea', 'air', 'land'].includes(itemShippingType)
      ? itemShippingType
      : null;

    if (tokens.length === 1) {
      const p = priceFor(tokens[0]);
      if (p != null) price = p;
    } else if (tokens.length > 1) {
      if (chosenToken && tokens.includes(chosenToken)) {
        const p = priceFor(chosenToken);
        if (p != null) price = p;
      } else if (
        item.shipping_option_index != null &&
        (!Array.isArray(product.pre_order_shipping_options) || product.pre_order_shipping_options.length === 0)
      ) {
        // Legacy cart items (pre-fix) — reconstruct ProductDetail fallback order:
        // sea → air → land, filtered by active tokens with a positive price.
        const order: string[] = [];
        if (tokens.includes('sea') && priceFor('sea') != null) order.push('sea');
        if (tokens.includes('air') && priceFor('air') != null) order.push('air');
        if (tokens.includes('land') && priceFor('land') != null) order.push('land');
        const idx = Number(item.shipping_option_index);
        const tok = order[idx];
        const p = tok ? priceFor(tok) : null;
        if (p != null) price = p;
        else {
          // Last resort: cheapest available
          const candidates = order.map(priceFor).filter((n): n is number => n != null);
          if (candidates.length > 0) price = Math.min(...candidates);
        }
      } else {
        const candidates: number[] = [];
        if (tokens.includes('sea')) { const p = priceFor('sea'); if (p != null) candidates.push(p); }
        if (tokens.includes('air')) { const p = priceFor('air'); if (p != null) candidates.push(p); }
        if (tokens.includes('land')) { const p = priceFor('land'); if (p != null) candidates.push(p); }
        if (candidates.length > 0) price = Math.min(...candidates);
      }
    }
  }

  // 3+4. Independent-price overrides from color and/or option.
  //  Semantics (new): price_adjustment is the option's INDEPENDENT IQD price.
  //  When set (> 0), it REPLACES the base price. When both a color override
  //  and an option override exist, their values SUM to replace the base.
  //  When neither is set, the base price is used.
  let colorOverride: number | null = null;
  const selColor = item.selected_color;
  if (selColor && product.colors) {
    const colorData = (product.colors as any[]).find(
      (c: any) => c.name === selColor || c.name_ar === selColor || c.hex_code === selColor
    );
    if (colorData) {
      const rawColor = isDirect && colorData.direct_sale_price != null
        ? Number(colorData.direct_sale_price)
        : colorData.price != null
          ? Number(colorData.price)
          : null;
      if (rawColor != null && rawColor > 0) {
        colorOverride = ensurePriceIqd(rawColor, priceUsd, usdToIqd);
      }
    }
  }

  let optionOverride: number | null = null;
  const optAdj = item.product_options?.price_adjustment;
  if (optAdj != null && Number(optAdj) > 0) {
    optionOverride = ensureAdjustmentIqd(Number(optAdj), usdToIqd, priceUsd);
  }

  if (colorOverride != null && optionOverride != null) {
    price = colorOverride + optionOverride;
  } else if (colorOverride != null) {
    price = colorOverride;
  } else if (optionOverride != null) {
    price = optionOverride;
  }
  // else: keep computed base/sale-type price from steps 1–2.

  // 5. Add pre-order shipping adjustment (still additive — shipping is not a price replacement)
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

/**
 * Returns the minimum INDEPENDENT price (in IQD) among eligible product_options
 * whose `price_adjustment` is set (> 0) — i.e. options that override the base.
 *
 * Returns `null` when no eligible option carries an independent price; callers
 * should then fall back to the product base. This replaces the old additive
 * "min adjustment" helper.
 *
 * - Direct sale: option must be available_for_direct_sale AND have stock
 *   (stock_quantity > 0 OR colors[].option_stocks summing > 0).
 * - Pre-order: all options eligible.
 */
export function getMinOptionOverridePriceIqd(
  product: any,
  saleType: 'direct' | 'preorder',
  usdToIqd: number,
): number | null {
  const options = Array.isArray(product?.product_options) ? product.product_options : [];
  if (options.length === 0) return null;
  const priceUsd = product?.price_usd ?? null;
  const colors = Array.isArray(product?.colors) ? product.colors : [];

  const norm = (s: any) =>
    String(s ?? '')
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const colorsHaveStocks = colors.some(
    (c: any) => c?.option_stocks && typeof c.option_stocks === 'object' && Object.keys(c.option_stocks).length > 0,
  );

  const stockFromColors = (optName: string): number => {
    if (!colorsHaveStocks || !optName) return 0;
    const target = norm(optName);
    let total = 0;
    for (const c of colors) {
      if ((c?.available_for_direct_sale ?? true) === false) continue;
      const stocks = c?.option_stocks;
      if (!stocks || typeof stocks !== 'object') continue;
      const key = Object.keys(stocks).find((k) => norm(k) === target);
      if (key) total += Math.max(0, Number((stocks as any)[key]) || 0);
    }
    return total;
  };

  const overrides: number[] = [];
  for (const opt of options) {
    if (saleType === 'direct') {
      if ((opt?.available_for_direct_sale ?? true) === false) continue;
      const hasStock = colorsHaveStocks
        ? stockFromColors(opt?.name_ar || opt?.name || '') > 0
        : opt?.stock_quantity != null && Number(opt.stock_quantity) > 0;
      if (!hasStock) continue;
    }
    const adj = Number(opt?.price_adjustment) || 0;
    if (adj <= 0) continue; // empty/zero = use base, not an override
    overrides.push(ensureAdjustmentIqd(adj, usdToIqd, priceUsd));
  }
  if (overrides.length === 0) return null;
  return Math.min(...overrides);
}

/**
 * @deprecated Use {@link getMinOptionOverridePriceIqd}. Kept as a thin
 * wrapper that returns 0 (no adjustment) under the new independent-price
 * semantics — option prices are no longer additive.
 */
export function getMinOptionAdjustmentIqd(
  _product: any,
  _saleType: 'direct' | 'preorder',
  _usdToIqd: number,
): number {
  return 0;
}
