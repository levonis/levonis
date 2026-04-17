

## Issue
Cart with 21 PLA filaments + 1 printer using **التوصيل الشخصي** (personal delivery) shows only 4,000 د.ع for filaments instead of `Math.ceil(21/10) × 4000 = 12,000 د.ع`.

## Root Cause (`src/pages/Cart.tsx`)

In `getDeliveryFee` (and the mirror `getMethodPreviewPrice`), when the selected method is `personal` (which has `base_price_category_id = الطابعات`):

1. The exceptions loop only looks at `catExceptions` filtered for `delivery_method_key = 'personal'` — but PLA's exception is registered under the **standard** method.
2. PLA is then treated as an "uncovered item" and falls into the fallback at line 600–612, which adds **a single flat `standard` price (4,000)** for ALL uncovered items combined — completely ignoring `units_per_delivery` and per-category exceptions of the standard method.

So 21 PLA → 4,000 (wrong) instead of 3 × 4,000 = 12,000.

## Fix

Refactor the "uncovered items fallback" inside `getDeliveryFee` (lines ~590-614) and the matching block in `getMethodPreviewPrice` (lines ~232-247) so that:

For each uncovered category, look up the matching **standard method** category exception in `allCatExceptions`:
- If found and it is `__follow_gov__` → `Math.ceil(qty / units_per_delivery) × govPrice` (or standard base price if no gov exception).
- If found with a flat price → `Math.ceil(qty / units_per_delivery) × delivery_price`.
- If not found → fall back to standard method's gov exception OR base price (current behavior — single flat fee).

Items with no `category_id` keep current behavior (single base/gov fee added once).

## Result
- Personal delivery + 21 PLA + 1 printer = **50,000 + 12,000 = 62,000 د.ع** instead of 54,000.
- All `units_per_delivery` thresholds across categories are honored regardless of which delivery method is selected.
- Preview prices in the method picker stay in sync with the actual fee.

## File touched
- `src/pages/Cart.tsx` — update `getDeliveryFee` and `getMethodPreviewPrice` to apply standard-method category exceptions to uncovered items.

