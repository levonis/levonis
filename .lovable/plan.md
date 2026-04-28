## Goal

Allow admins to specify exactly which product categories are eligible for the **percentage discount** and **free shipping** benefits coming from:

1. **Printer warranty benefits** (per-printer, table `printer_warranty_benefits`)
2. **Loyalty card / level** (table `loyalty_levels`)
3. **Protection plans / Insurance** (table `protection_plans` — already has `parts_discount_categories`, will extend to also gate free shipping if applicable)

Today, the percentage discount applies to the entire cart subtotal and free shipping applies to all carts. We will scope both to a configurable category whitelist (e.g. only "PLA / PETG / ABS / ASA / Hardware Parts" — i.e. printing materials), so a customer buying e.g. a Printer or Add-on does NOT consume the warranty/card monthly benefit.

If the whitelist is empty (or null) → behavior stays as today (applies to everything) for backward compatibility.

## Database changes (migration)

Add nullable `applicable_category_ids uuid[]` columns:

- `printer_warranty_benefits.discount_applicable_category_ids uuid[]`
- `printer_warranty_benefits.free_shipping_applicable_category_ids uuid[]`
- `loyalty_levels.discount_applicable_category_ids uuid[]`
- `loyalty_levels.free_shipping_applicable_category_ids uuid[]`

Semantics: `NULL` or empty array = applies to all categories (current behavior). Non-empty array = applies only to items whose `products.category_id` is in the list; free shipping = cart must contain at least one eligible item AND/OR (configurable later — for v1: at least one eligible item is enough to grant free shipping, mirroring how loyalty card free shipping works today).

Update RPC `get_active_warranty_benefits_for_user` to also return the two new arrays.

## Admin UI changes

### 1. `src/pages/AdminPrinterWarrantyBenefits.tsx` (per-printer)
Inside each `SettingsRow` add two collapsible category multi-selects:
- "الأقسام المشمولة بالخصم" (categories included in % discount)
- "الأقسام المشمولة بالتوصيل المجاني" (categories included in free shipping)

Each renders all categories with checkboxes. "بدون تحديد = يشمل كل الأقسام" hint shown when empty. Save handler upserts the two arrays.

### 2. `src/pages/AdminLoyaltyLevels.tsx` (per loyalty level / card)
In the level edit form add the same two category multi-select sections, persisted on `loyalty_levels`.

### 3. `src/pages/AdminPrinterProtection.tsx` (protection plans)
Already has `parts_discount_categories` for the parts discount. Add a small note clarifying this also restricts the discount scope (no schema change needed for plans v1).

## Cart logic changes

### `src/hooks/useCartWarrantyBenefits.tsx`
Replace the current "compute discount on full `cartSubtotal`" with:
- Build `eligibleSubtotal` = sum of `getItemPrice(item) * quantity` for items whose `category_id ∈ discount_applicable_category_ids` (or all items if list empty/null, gifts excluded).
- `percentageDiscount = floor(eligibleSubtotal * rate / 100)` capped by remaining monthly cap.
- Also expose `freeShippingApplicableCategoryIds` so `Cart.tsx` can check whether at least one cart item belongs to that whitelist before granting free shipping.

### `src/hooks/useCartCardDiscount.tsx`
Same pattern for the loyalty level percentage discount and free shipping. Per-item card discounts (`product.card_discounts` JSON) already implicitly category-scoped; only the global `percentageDiscount` and `freeShipping` need the new whitelist.

### `src/pages/Cart.tsx`
- Where `warrantyFreeShippingApplied` / `cardFreeShippingApplied` are computed, additionally require: `(applicableCategoryIds is empty) OR cart.items.some(i => applicableCategoryIds.includes(i.products.category_id))`.
- Discount totals then use the new scoped values from the hooks (no other change needed).

## i18n

Add 3-language keys (ar, en, ku) for:
- `admin_benefits_categories_for_discount`
- `admin_benefits_categories_for_shipping`
- `admin_benefits_categories_hint_all` ("اتركه فارغًا ليشمل جميع الأقسام")

## Memory update

Update `mem://features/hardware/warranty-loyalty-benefits` to document the new category whitelist columns and the "empty = all" rule.

## Out of scope (v1)

- Per-category override of free shipping minimum order
- UI surfacing (in Cart) of why a benefit didn't apply (will keep silent fallback)
- Migrating existing rows: all rows stay NULL → behavior unchanged until admin opts in
