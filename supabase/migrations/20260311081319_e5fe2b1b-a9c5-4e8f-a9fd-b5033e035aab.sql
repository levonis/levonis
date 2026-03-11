
DROP INDEX IF EXISTS public.ux_cart_items_user_product_option_color_shipping;

CREATE UNIQUE INDEX ux_cart_items_user_product_option_color_shipping 
ON public.cart_items (user_id, COALESCE(product_id, '00000000-0000-0000-0000-000000000000'), COALESCE(product_option_id, '00000000-0000-0000-0000-000000000000'), COALESCE(selected_color, ''), COALESCE(shipping_option_index, -1), COALESCE(bundle_id, '00000000-0000-0000-0000-000000000000'));
