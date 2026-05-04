
-- A) Add category_ids array column
ALTER TABLE public.random_filament_offers
  ADD COLUMN IF NOT EXISTS category_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE public.random_filament_offers
   SET category_ids = ARRAY[category_id]
 WHERE category_id IS NOT NULL
   AND (category_ids IS NULL OR array_length(category_ids,1) IS NULL);

-- B) Replace create_random_filament_order: use category_ids, lock & decrement stock
CREATE OR REPLACE FUNCTION public.create_random_filament_order(p_category_id uuid, p_offer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_settings public.random_filament_settings;
  v_offer public.random_filament_offers;
  v_product public.products;
  v_option_id uuid;
  v_option public.product_options;
  v_color text;
  v_color_image text;
  v_cart_item_id uuid;
  v_rfo_id uuid;
  v_sale_type text;
  v_has_whitelist boolean;
  v_in_categories boolean;
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
   WHERE id = p_offer_id AND enabled = true;
  IF v_offer.id IS NULL THEN RAISE EXCEPTION 'OFFER_NOT_FOUND'; END IF;
  IF v_offer.price_iqd <= 0 THEN RAISE EXCEPTION 'PRICE_NOT_CONFIGURED'; END IF;

  -- offer must include the chosen category (legacy: empty array + category_id match still ok)
  v_in_categories :=
    (COALESCE(array_length(v_offer.category_ids, 1), 0) > 0
     AND p_category_id = ANY(v_offer.category_ids))
    OR (COALESCE(array_length(v_offer.category_ids, 1), 0) = 0
        AND (v_offer.category_id IS NULL OR v_offer.category_id = p_category_id));
  IF NOT v_in_categories THEN
    RAISE EXCEPTION 'OFFER_NOT_FOUND';
  END IF;

  v_sale_type := v_offer.sale_type;
  v_has_whitelist := COALESCE(array_length(v_offer.allowed_product_ids, 1), 0) > 0;

  IF v_sale_type = 'direct' THEN
    -- pick a random product that has at least one direct option with stock
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
    -- lock a random eligible option and decrement its stock atomically
    SELECT id INTO v_option_id FROM public.product_options
    WHERE product_id = v_product.id
      AND COALESCE(available_for_direct_sale, false) = true
      AND COALESCE(stock_quantity, 0) > 0
    ORDER BY random() LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_option_id IS NULL THEN RAISE EXCEPTION 'NO_COLOR_AVAILABLE'; END IF;

    UPDATE public.product_options
       SET stock_quantity = stock_quantity - 1
     WHERE id = v_option_id
       AND COALESCE(stock_quantity, 0) > 0
    RETURNING * INTO v_option;

    IF v_option.id IS NULL THEN RAISE EXCEPTION 'NO_COLOR_AVAILABLE'; END IF;
  ELSE
    SELECT * INTO v_option FROM public.product_options
    WHERE product_id = v_product.id
      AND COALESCE(available_for_pre_order, true) = true
    ORDER BY random() LIMIT 1;

    IF v_option.id IS NULL THEN RAISE EXCEPTION 'NO_COLOR_AVAILABLE'; END IF;
  END IF;

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
$function$;

-- C) Stock + sales summary RPC for offer cards
CREATE OR REPLACE FUNCTION public.rf_offer_stock_summary(p_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_offer public.random_filament_offers;
  v_stock bigint := 0;
  v_sales bigint := 0;
  v_has_whitelist boolean;
  v_cat_ids uuid[];
BEGIN
  SELECT * INTO v_offer FROM public.random_filament_offers WHERE id = p_offer_id;
  IF v_offer.id IS NULL THEN RETURN jsonb_build_object('direct_stock_total',0,'sales_count',0); END IF;

  v_has_whitelist := COALESCE(array_length(v_offer.allowed_product_ids,1),0) > 0;
  v_cat_ids := COALESCE(NULLIF(v_offer.category_ids,'{}'),
                       CASE WHEN v_offer.category_id IS NOT NULL THEN ARRAY[v_offer.category_id] ELSE '{}'::uuid[] END);

  IF v_offer.sale_type = 'direct' THEN
    SELECT COALESCE(SUM(GREATEST(o.stock_quantity,0)),0) INTO v_stock
    FROM public.product_options o
    JOIN public.products p ON p.id = o.product_id
    WHERE COALESCE(o.available_for_direct_sale,false) = true
      AND COALESCE(o.stock_quantity,0) > 0
      AND p.in_stock = true
      AND (NOT v_has_whitelist OR p.id = ANY(v_offer.allowed_product_ids))
      AND (COALESCE(array_length(v_cat_ids,1),0) = 0 OR p.category_id = ANY(v_cat_ids));
  END IF;

  SELECT COUNT(*) INTO v_sales
  FROM public.random_filament_orders
  WHERE offer_id = p_offer_id AND order_id IS NOT NULL;

  RETURN jsonb_build_object(
    'direct_stock_total', v_stock,
    'sales_count', v_sales
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rf_offer_stock_summary(uuid) TO anon, authenticated;

-- D) Storage bucket for random filament offer images
INSERT INTO storage.buckets (id, name, public)
VALUES ('random-filament-offers', 'random-filament-offers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "RF offers images are publicly accessible" ON storage.objects;
CREATE POLICY "RF offers images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'random-filament-offers');

DROP POLICY IF EXISTS "Admins can upload RF offer images" ON storage.objects;
CREATE POLICY "Admins can upload RF offer images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'random-filament-offers' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update RF offer images" ON storage.objects;
CREATE POLICY "Admins can update RF offer images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'random-filament-offers' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete RF offer images" ON storage.objects;
CREATE POLICY "Admins can delete RF offer images"
ON storage.objects FOR DELETE
USING (bucket_id = 'random-filament-offers' AND public.has_role(auth.uid(), 'admin'));
