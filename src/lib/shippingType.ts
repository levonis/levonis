/**
 * Helpers for the polymorphic `products.shipping_type` column.
 *
 * Historically the column held a single value: 'sea' | 'air' | 'both'.
 * With land shipping added, it now holds a comma-separated list of tokens
 * drawn from {'sea','air','land'}. Legacy 'both' is treated as 'sea,air'.
 *
 * Use these helpers everywhere instead of bare `=== 'sea'` checks so future
 * additions stay backward-compatible.
 */
export type ShippingToken = 'sea' | 'air' | 'land';

export function parseShippingTokens(value: string | null | undefined): ShippingToken[] {
  if (!value) return [];
  if (value === 'both') return ['sea', 'air'];
  return String(value)
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t): t is ShippingToken => t === 'sea' || t === 'air' || t === 'land');
}

export function hasShipping(value: string | null | undefined, token: ShippingToken): boolean {
  return parseShippingTokens(value).includes(token);
}

/** Build a canonical comma-separated string from boolean toggles. */
export function buildShippingType(opts: { sea?: boolean; air?: boolean; land?: boolean }): string {
  const tokens: ShippingToken[] = [];
  if (opts.sea) tokens.push('sea');
  if (opts.air) tokens.push('air');
  if (opts.land) tokens.push('land');
  return tokens.join(',');
}
