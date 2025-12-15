-- Fix cart unique constraint to allow same product/option/color with different shipping options

-- 1) Drop the old unique index/constraint (name from error message)
DROP INDEX IF EXISTS public."ux_cart_items_user_product_option_color";

-- 2) Create a new unique index that also includes shipping_option_index
-- We use COALESCE to make NULLs comparable (so NULL behaves like a real value for uniqueness).
-- We scope it to normal product cart rows (custom_request_id is null).
CREATE UNIQUE INDEX IF NOT EXISTS ux_cart_items_user_product_option_color_shipping
ON public.cart_items (
  user_id,
  product_id,
  COALESCE(product_option_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(selected_color, ''),
  COALESCE(shipping_option_index, -1)
)
WHERE custom_request_id IS NULL;

-- (Optional safety) Prevent duplicate custom requests per user (if not already enforced)
CREATE UNIQUE INDEX IF NOT EXISTS ux_cart_items_user_custom_request
ON public.cart_items (user_id, custom_request_id)
WHERE custom_request_id IS NOT NULL;