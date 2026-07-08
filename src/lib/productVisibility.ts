/**
 * Single source of truth for user-facing product visibility.
 *
 * Admin toggles product visibility via the `is_pricing_updated` boolean:
 * - true  => published to users
 * - false => hidden from users (admin-only)
 *
 * Every user-facing query on `products` MUST call `applyPublicVisibility`
 * (or `PUBLIC_VISIBLE_FILTER`) so hidden products never leak to the
 * store, product detail, cart, or any other public surface.
 *
 * Admin/system queries (`products_admin` view, background jobs, order
 * history) intentionally skip this filter.
 */

export const PUBLIC_VISIBLE_FILTER = { is_pricing_updated: true } as const;

/**
 * Chainable helper — appends `.eq('is_pricing_updated', true)` to a
 * Supabase query builder. Works for any PostgREST filter builder that
 * exposes `.eq(column, value)`.
 */
export function applyPublicVisibility<T extends { eq: (col: string, val: any) => T }>(query: T): T {
  return query.eq('is_pricing_updated', true);
}

/**
 * Utility guard for arrays fetched from other paths (e.g. bulk lookups
 * where filtering server-side is inconvenient). Returns only the rows
 * that are publicly visible.
 */
export function keepPubliclyVisible<T extends { is_pricing_updated?: boolean | null }>(rows: T[] | null | undefined): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => r?.is_pricing_updated === true);
}
