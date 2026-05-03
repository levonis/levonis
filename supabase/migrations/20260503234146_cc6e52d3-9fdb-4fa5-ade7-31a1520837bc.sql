-- 1) Whitelist of products per offer (empty/null = all category products)
ALTER TABLE public.random_filament_offers
  ADD COLUMN IF NOT EXISTS allowed_product_ids uuid[] NOT NULL DEFAULT '{}';

-- 2) Update RPC to honor whitelist
CREATE OR REPLACE FUNCTION public.create_random_filament_order(
  p_category_id uuid,
  p_offer_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_settings public.random_filament_settings;
  v_offer public.random_filament_offers;
  v_product public.products;
  v_option public.product_options;
  v_color text;
  v_color_image text;
  v_cart_item_id uuid;
  v_rfo_id uuid;
  v_sale_type text;
  v_has_whitelist boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF EXISTS (SELECT 1 FROM public.random_filament_bans WHERE user_id = v_user) THEN
    RAISE EXCEPTION 'USER_BANNED';
  END IF;

  SELECT * INTO v_settings FROM public.random_filament_settings LIMIT 1;
  IF NOT v_settings.enabled THEN RAISE EXCEPTION 'SECTION_DISABLED'; END IF;
  IF NOT (p_category_id = ANY(v_settings.category_ids)) THEN
    RAISE EXCEPTION 'CATEGORY_NOT_ALLOWED';
  END IF;

  SELECT * INTO v_offer FROM public.random_filament_offers
   WHERE id = p_offer_id AND enabled = true
     AND (category_id IS NULL OR category_id = p_category_id);
  IF v_offer.id IS NULL THEN RAISE EXCEPTION 'OFFER_NOT_FOUND'; END IF;
  IF v_offer.price_iqd <= 0 THEN RAISE EXCEPTION 'PRICE_NOT_CONFIGURED'; END IF;

  v_sale_type := v_offer.sale_type;
  v_has_whitelist := COALESCE(array_length(v_offer.allowed_product_ids, 1), 0) > 0;

  IF v_sale_type = 'direct' THEN
    SELECT p.* INTO v_product FROM public.products p
    WHERE p.category_id = p_category_id AND p.in_stock = true
      AND (NOT v_has_whitelist OR p.id = ANY(v_offer.allowed_product_ids))
      AND EXISTS (SELECT 1 FROM public.product_options o
        WHERE o.product_id = p.id
          AND COALESCE(o.available_for_direct_sale, false) = true
          AND COALESCE(o.stock_quantity, 0) > 0)
    ORDER BY random() LIMIT 1;
  ELSE
    SELECT p.* INTO v_product FROM public.products p
    WHERE p.category_id = p_category_id
      AND (NOT v_has_whitelist OR p.id = ANY(v_offer.allowed_product_ids))
      AND EXISTS (SELECT 1 FROM public.product_options o
        WHERE o.product_id = p.id
          AND COALESCE(o.available_for_pre_order, true) = true)
    ORDER BY random() LIMIT 1;
  END IF;

  IF v_product.id IS NULL THEN RAISE EXCEPTION 'NO_PRODUCT_AVAILABLE'; END IF;

  IF v_sale_type = 'direct' THEN
    SELECT * INTO v_option FROM public.product_options
    WHERE product_id = v_product.id
      AND COALESCE(available_for_direct_sale, false) = true
      AND COALESCE(stock_quantity, 0) > 0
    ORDER BY random() LIMIT 1;
  ELSE
    SELECT * INTO v_option FROM public.product_options
    WHERE product_id = v_product.id
      AND COALESCE(available_for_pre_order, true) = true
    ORDER BY random() LIMIT 1;
  END IF;

  IF v_option.id IS NULL THEN RAISE EXCEPTION 'NO_COLOR_AVAILABLE'; END IF;

  v_color := COALESCE(v_option.name_ar, v_option.name);
  v_color_image := v_option.image_url;

  INSERT INTO public.cart_items (
    user_id, product_id, product_option_id, selected_color,
    color_image_url, quantity, sale_type, is_locked
  ) VALUES (
    v_user, v_product.id, v_option.id, v_color,
    v_color_image, 1, v_sale_type, true
  ) RETURNING id INTO v_cart_item_id;

  INSERT INTO public.random_filament_orders (
    user_id, cart_item_id, category_id, sale_type,
    product_id, product_option_id, selected_color, price_iqd, offer_id
  ) VALUES (
    v_user, v_cart_item_id, p_category_id, v_sale_type,
    v_product.id, v_option.id, v_color, v_offer.price_iqd, v_offer.id
  ) RETURNING id INTO v_rfo_id;

  RETURN jsonb_build_object(
    'success', true,
    'cart_item_id', v_cart_item_id,
    'random_order_id', v_rfo_id,
    'price_iqd', v_offer.price_iqd,
    'sale_type', v_sale_type
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_random_filament_order(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_random_filament_order(uuid,uuid) TO authenticated;

-- 3) Auto-reveal trigger when order becomes fully paid
CREATE OR REPLACE FUNCTION public.auto_reveal_rf_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND COALESCE(OLD.payment_status,'') <> 'paid' THEN
    UPDATE public.random_filament_orders rfo
    SET revealed_at = COALESCE(revealed_at, now()),
        order_id = COALESCE(rfo.order_id, NEW.id)
    WHERE rfo.user_id = NEW.user_id
      AND (rfo.order_id = NEW.id OR rfo.order_id IS NULL)
      AND EXISTS (
        SELECT 1 FROM public.order_items oi
        WHERE oi.order_id = NEW.id
          AND oi.product_id = rfo.product_id
          AND COALESCE(oi.product_option_id::text,'') = COALESCE(rfo.product_option_id::text,'')
      );

    UPDATE public.order_items oi
    SET product_name = COALESCE(p.name, oi.product_name),
        product_name_ar = COALESCE(p.name_ar, oi.product_name_ar),
        selected_color = COALESCE(rfo.selected_color, oi.selected_color)
    FROM public.random_filament_orders rfo
    JOIN public.products p ON p.id = rfo.product_id
    WHERE rfo.order_id = NEW.id
      AND oi.order_id = NEW.id
      AND oi.product_id = rfo.product_id
      AND COALESCE(oi.product_option_id::text,'') = COALESCE(rfo.product_option_id::text,'');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_reveal_rf_on_payment ON public.orders;
CREATE TRIGGER trg_auto_reveal_rf_on_payment
  AFTER UPDATE OF payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.auto_reveal_rf_on_payment();