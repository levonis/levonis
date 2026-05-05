/**
 * Runtime type guards for cart items used by pricing & discount calculations.
 *
 * These guards exist because:
 *   - Cart items come from Supabase joins where flags can be `null`/`undefined`
 *     instead of strict booleans.
 *   - `sale_type` is a free string column at the DB level, so we must
 *     normalize to the literal union `'direct' | 'preorder'` at the boundary.
 *   - Pricing/discount logic must NEVER silently treat an undefined flag as
 *     `false` if the caller actually expected it to be present — better to
 *     dev-warn and skip the item than to apply a wrong discount.
 *
 * Use these helpers everywhere in pricing/discount hooks instead of raw
 * `item.is_gift === true` / `item.sale_type === 'direct'` checks.
 */

import type { SaleType } from './cartSaleType';
import { getItemSaleType } from './cartSaleType';

const isDev =
  typeof import.meta !== 'undefined' &&
  (import.meta as any)?.env?.DEV === true;

function devWarn(scope: string, message: string, item: unknown): void {
  if (!isDev) return;
  // eslint-disable-next-line no-console
  console.warn(`[cartItemGuards:${scope}] ${message}`, item);
}

/* -------------------------------------------------------------------------- */
/* Boolean flag normalization                                                 */
/* -------------------------------------------------------------------------- */

/** Strict boolean read with dev-warn for unexpected types. */
export function readBooleanFlag(
  item: any,
  field: string,
  defaultValue = false,
): boolean {
  const raw = item?.[field];
  if (raw === true || raw === false) return raw;
  if (raw === null || raw === undefined) return defaultValue;
  if (raw === 1 || raw === 0) return raw === 1;
  if (raw === 'true' || raw === 'false') return raw === 'true';
  devWarn('readBooleanFlag', `Unexpected value for "${field}"`, raw);
  return defaultValue;
}

export const isGiftItem = (item: any): boolean => readBooleanFlag(item, 'is_gift');
export const isLockedItem = (item: any): boolean => readBooleanFlag(item, 'is_locked');
export const isRandomFilamentItem = (item: any): boolean =>
  readBooleanFlag(item, 'is_random_filament');
export const isRandomFilamentRevealed = (item: any): boolean =>
  readBooleanFlag(item, 'is_random_filament_revealed');

/* -------------------------------------------------------------------------- */
/* Sale type guards                                                           */
/* -------------------------------------------------------------------------- */

/** True iff `item.sale_type` is one of the expected literals. */
export function hasValidSaleType(item: any): item is { sale_type: SaleType } {
  return item?.sale_type === 'direct' || item?.sale_type === 'preorder';
}

/** True iff item is a confirmed direct sale item (sale_type === 'direct'). */
export function isDirectSaleItem(item: any): boolean {
  if (!hasValidSaleType(item)) {
    devWarn('isDirectSaleItem', 'Missing/invalid sale_type', item);
    return false;
  }
  return getItemSaleType(item) === 'direct';
}

export function isPreorderItem(item: any): boolean {
  if (!hasValidSaleType(item)) {
    devWarn('isPreorderItem', 'Missing/invalid sale_type', item);
    return false;
  }
  return getItemSaleType(item) === 'preorder';
}

/* -------------------------------------------------------------------------- */
/* Composite guards used by discount/benefit hooks                            */
/* -------------------------------------------------------------------------- */

/**
 * The canonical predicate for "should this item participate in
 * discounts / loyalty / warranty / protection calculations?"
 *
 * Excludes:
 *   - gift rows (price = 0, no discount)
 *   - locked random-filament rows (price already finalized)
 *   - revealed RF rows (treated like a sealed product, not a regular SKU)
 */
export function isDiscountEligibleItem(item: any): boolean {
  if (!item) return false;
  if (isGiftItem(item)) return false;
  if (isLockedItem(item)) return false;
  if (isRandomFilamentItem(item) && !isRandomFilamentRevealed(item)) {
    // Sealed RF: price not yet finalized → skip discounts.
    return false;
  }
  return true;
}

/**
 * Numeric guard for prices/quantities. Returns a safe finite number,
 * defaulting to 0 if the field is missing or non-numeric.
 */
export function readNumericField(
  item: any,
  field: string,
  defaultValue = 0,
): number {
  const raw = item?.[field];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  if (raw !== null && raw !== undefined) {
    devWarn('readNumericField', `Non-numeric "${field}"`, raw);
  }
  return defaultValue;
}

export function readQuantity(item: any): number {
  const q = readNumericField(item, 'quantity', 1);
  return q > 0 ? Math.trunc(q) : 1;
}
