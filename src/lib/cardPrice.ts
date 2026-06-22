/**
 * Single source of truth for prices shown on product cards.
 *
 * MUST always agree with what ProductDetail will display for the cheapest
 * available combination. CategoryDetail (cards + featured), ProductDetail
 * (related products), and any future card surface MUST use these helpers
 * — never reimplement the logic locally.
 */
import { computeLinkedDirectSalePrice, computeLinkedDirectSalePriceFromCostIqd, ensurePriceIqd, getDirectVariantPriceMapKey, getMinOptionOverridePriceIqd, getProductBaseCostIqd } from './priceGuard';
import { isAllDirectStockDepleted } from './stockUtils';

export function computeUnifiedCardPrice(
  product: any,
  usdToIqd: number,
  codDefaults: any,
  liveDirectMap?: Map<string, number> | null,
  liveVariantDirectMap?: Map<string, number> | null,
): number {
  const shouldRoundUp = product?.round_up_price === true;
  const roundIfNeeded = (n: number) => (shouldRoundUp ? Math.ceil(n / 250) * 250 : n);

  const hasDirect = (product?.has_in_stock ?? false) && !isAllDirectStockDepleted(product);
  const hasPreOrder = !!product?.has_pre_order;
  const candidates: number[] = [];

  // --- Direct sale candidate ---
  if (hasDirect) {
    let directBase: number | null = null;
    if (product?.link_direct_commission_to_cod) {
      const fromServer =
        liveDirectMap && typeof (liveDirectMap as any).get === 'function'
          ? (liveDirectMap as Map<string, number>).get(product.id)
          : (liveDirectMap as any)?.[product.id];
      if (fromServer != null && fromServer > 0) directBase = fromServer;
      else if (codDefaults) {
        const live = computeLinkedDirectSalePrice(
          product,
          { usd_to_iqd_rate: usdToIqd } as any,
          codDefaults,
        );
        if (live != null && live > 0) directBase = live;
      }
    }
    if (directBase == null && product?.direct_sale_price != null && Number(product.direct_sale_price) > 0) {
      directBase = ensurePriceIqd(Number(product.direct_sale_price), product?.price_usd, usdToIqd);
    }
    if (directBase != null) {
      const options = Array.isArray(product?.product_options) ? product.product_options : [];
      const colors = Array.isArray(product?.colors) ? product.colors : [];
      if (options.length > 0) {
        const eligible =
          options.some((opt: any) => {
            if ((opt?.available_for_direct_sale ?? true) === false) return false;
            return opt?.stock_quantity != null && Number(opt.stock_quantity) > 0;
          }) ||
          colors.some(
            (c: any) =>
              c?.option_stocks &&
              typeof c.option_stocks === 'object' &&
              Object.keys(c.option_stocks).length > 0,
          );
        if (eligible) {
          // Independent option price replaces the COST. When linked to COD,
          // re-derive the sale price from that overridden cost; otherwise
          // use the override directly as the sale price.
          const minOverride = getMinOptionOverridePriceIqd(product, 'direct', usdToIqd);
          if (minOverride != null) {
            const baseCostIqd = ensurePriceIqd(Number(product?.price || 0), product?.price_usd, usdToIqd);
            const saleTypeAddons = directBase - baseCostIqd;
            let finalFromOverride = minOverride;
            if (product?.link_direct_commission_to_cod && codDefaults) {
              const fromVariantMap = product?.id
                ? liveVariantDirectMap?.get(getDirectVariantPriceMapKey(product.id, minOverride))
                : null;
              const derived = fromVariantMap && fromVariantMap > 0 ? fromVariantMap : computeLinkedDirectSalePriceFromCostIqd(
                product,
                minOverride,
                { usd_to_iqd_rate: usdToIqd } as any,
                codDefaults,
              );
              if (derived != null) finalFromOverride = derived;
            } else {
              finalFromOverride = minOverride + saleTypeAddons;
            }
            candidates.push(Math.min(finalFromOverride, directBase));
          } else {
            candidates.push(directBase);
          }
        }
      } else {
        candidates.push(directBase);
      }
    }
  }

  // --- Pre-order candidate ---
  if (hasPreOrder) {
    const st: string = product?.shipping_type || '';
    const tokens = st === 'both' ? ['sea', 'air'] : st.split(',').map((t: string) => t.trim()).filter(Boolean);
    const sea = product?.sea_price ? ensurePriceIqd(Number(product.sea_price), product?.price_usd, usdToIqd) : null;
    const air = product?.air_price ? ensurePriceIqd(Number(product.air_price), product?.price_usd, usdToIqd) : null;
    const land = product?.land_price ? ensurePriceIqd(Number(product.land_price), product?.price_usd, usdToIqd) : null;
    const opts: number[] = [];
    if (tokens.includes('sea') && sea) opts.push(sea);
    if (tokens.includes('air') && air) opts.push(air);
    if (tokens.includes('land') && land) opts.push(land);
    const preBase = opts.length > 0 ? Math.min(...opts) : null;
    if (preBase != null) {
      const minOverride = getMinOptionOverridePriceIqd(product, 'preorder', usdToIqd);
      candidates.push(minOverride != null ? Math.min(minOverride, preBase) : preBase);
    }
  }

  if (candidates.length === 0) {
    return roundIfNeeded(ensurePriceIqd(Number(product?.price || 0), product?.price_usd, usdToIqd));
  }
  return roundIfNeeded(Math.min(...candidates));
}

/**
 * Returns the original (pre-discount) price suitable for a strikethrough.
 * Returns null when there is nothing to show (no original_price, or it's
 * not strictly greater than the final card price).
 */
export function computeUnifiedCardOriginalPrice(
  product: any,
  usdToIqd: number,
  codDefaults?: any,
  liveDirectMap?: Map<string, number> | null,
  liveVariantDirectMap?: Map<string, number> | null,
): number | null {
  const orig = product?.original_price;
  if (orig == null || Number(orig) <= 0) return null;
  const shouldRoundUp = product?.round_up_price === true;
  const value = ensurePriceIqd(Number(orig), product?.price_usd, usdToIqd);
  const rounded = shouldRoundUp ? Math.ceil(value / 250) * 250 : value;
  const finalPrice = computeUnifiedCardPrice(product, usdToIqd, codDefaults, liveDirectMap, liveVariantDirectMap);
  return rounded > finalPrice ? rounded : null;
}

/**
 * Dev-only parity check.
 *
 * Invariant: the price shown on the card MUST be ≤ the price shown on the
 * detail page for the currently-selected option (the card promises the
 * cheapest possible). If the card ever shows a price *higher* than what
 * the detail page actually charges for some option, that's a leak — warn.
 *
 * Same invariant applies to the original (strikethrough) price.
 */
export function assertCardDetailParity(
  product: any,
  usdToIqd: number,
  codDefaults: any,
  liveDirectMap: Map<string, number> | null | undefined,
  detailFinalPrice: number,
  detailFinalOriginal: number | null,
): void {
  if (!product) return;
  try {
    // @ts-ignore
    const env = typeof import.meta !== 'undefined' ? (import.meta as any).env : null;
    if (env && env.DEV !== true && env.MODE !== 'test') return;
  } catch {}

  const cardPrice = computeUnifiedCardPrice(product, usdToIqd, codDefaults, liveDirectMap);
  if (cardPrice > detailFinalPrice + 1) {
    // eslint-disable-next-line no-console
    console.warn('[Price Parity] card overcharges vs detail', {
      product: product?.slug || product?.id,
      cardPrice,
      detailFinalPrice,
    });
  }
  const cardOrig = computeUnifiedCardOriginalPrice(product, usdToIqd, codDefaults, liveDirectMap);
  if (cardOrig != null && detailFinalOriginal != null && cardOrig > detailFinalOriginal + 1) {
    // eslint-disable-next-line no-console
    console.warn('[Price Parity] card original overcharges vs detail', {
      product: product?.slug || product?.id,
      cardOrig,
      detailFinalOriginal,
    });
  }
}
