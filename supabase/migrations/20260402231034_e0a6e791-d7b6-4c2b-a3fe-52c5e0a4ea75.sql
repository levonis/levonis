
-- Drop the existing unique index that blocks duplicate gifts
DROP INDEX IF EXISTS ux_cart_items_user_product_option_color_shipping;

-- Recreate for non-gift items only (keep dedup for regular cart items)
CREATE UNIQUE INDEX ux_cart_items_non_gift
  ON public.cart_items (user_id, product_id, product_option_id, selected_color, shipping_option_index)
  WHERE is_gift = false;
