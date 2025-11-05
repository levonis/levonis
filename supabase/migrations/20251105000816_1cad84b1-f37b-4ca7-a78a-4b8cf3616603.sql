-- Allow same product to exist multiple times in a cart when color/option differ
-- 1) Drop overly-restrictive unique constraint
ALTER TABLE public.cart_items
DROP CONSTRAINT IF EXISTS cart_items_user_id_product_id_key;

-- 2) Enforce uniqueness across user, product, option, and color
-- Use COALESCE to treat NULLs as deterministic values so duplicates with all-null option/color are prevented
CREATE UNIQUE INDEX IF NOT EXISTS ux_cart_items_user_product_option_color
ON public.cart_items (
  user_id,
  product_id,
  COALESCE(product_option_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(selected_color, '')
);
