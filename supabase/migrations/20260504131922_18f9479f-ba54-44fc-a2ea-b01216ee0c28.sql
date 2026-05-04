-- Random Filament: align direct-sale picking and stock with V3 colors+option_stocks model

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
  v_option public.product_options;
  v_color jsonb;
  v_color_name text;
  v_color_image text;
  v_option_key text;
  v_current_stock int;
  v_new_colors jsonb;
  v_color_idx int;
  v_cart_item_id uuid;
  v_rfo_id uuid;
  v_sale_type text;
  v_has_whitelist boolean;
  v_in_categories boolean;
  v_eligible_keys jsonb;
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
    -- Pick a random product whose colors contain at least one direct-sale color
    -- with a positive option_stocks entry. LOCK the product row so concurrent
    -- buyers cannot race on the colors JSON.
    SELECT p.* INTO v_product
    FROM public.products p
    WHERE p.category_id = p_category_id
      AND p.in_stock = true
      AND (NOT v_has_whitelist OR p.id = ANY(v_offer.allowed_product_ids))
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(p.colors::jsonb, '[]'::jsonb)) c
        WHERE COALESCE((c->>'available_for_direct_sale')::boolean, false) = true
          AND EXISTS (
            SELECT 1 FROM jsonb_each_text(COALESCE(c->'option_stocks','{}'::jsonb)) kv
            WHERE COALESCE(NULLIF(kv.value,'')::int, 0) > 0
          )
      )
    ORDER BY random()
    LIMIT 1
    FOR UPDATE;

    IF v_product.id IS NULL THEN RAISE EXCEPTION 'NO_PRODUCT_AVAILABLE'; END IF;

    -- Pick a random eligible color (with at least one positive option stock)
    SELECT c, idx - 1 INTO v_color, v_color_idx
    FROM jsonb_array_elements(COALESCE(v_product.colors::jsonb, '[]'::jsonb))
      WITH ORDINALITY AS t(c, idx)
    WHERE COALESCE((c->>'available_for_direct_sale')::boolean, false) = true
      AND EXISTS (
        SELECT 1 FROM jsonb_each_text(COALESCE(c->'option_stocks','{}'::jsonb)) kv
        WHERE COALESCE(NULLIF(kv.value,'')::int, 0) > 0
      )
    ORDER BY random()
    LIMIT 1;

    IF v_color IS NULL THEN RAISE EXCEPTION 'NO_COLOR_AVAILABLE'; END IF;

    -- Pick a random option key (with positive stock) from this color
    SELECT jsonb_agg(kv.key) INTO v_eligible_keys
    FROM jsonb_each_text(COALESCE(v_color->'option_stocks','{}'::jsonb)) kv
    WHERE COALESCE(NULLIF(kv.value,'')::int, 0) > 0;

    IF v_eligible_keys IS NULL OR jsonb_array_length(v_eligible_keys) = 0 THEN
      RAISE EXCEPTION 'NO_COLOR_AVAILABLE';
    END IF;

    SELECT (v_eligible_keys->>floor(random() * jsonb_array_length(v_eligible_keys))::int)
    INTO v_option_key;

    v_current_stock := COALESCE((v_color->'option_stocks'->>v_option_key)::int, 0);
    IF v_current_stock <= 0 THEN RAISE EXCEPTION 'NO_COLOR_AVAILABLE'; END IF;

    -- Decrement option_stocks[v_option_key] by 1 in the product's colors JSON
    v_new_colors := jsonb_set(
      v_product.colors::jsonb,
      ARRAY[v_color_idx::text, 'option_stocks', v_option_key],
      to_jsonb(v_current_stock - 1),
      false
    );

    UPDATE public.products
       SET colors = v_new_colors::jsonb
     WHERE id = v_product.id;

    -- Locate matching product_option (by name_ar OR name) for cart linkage
    SELECT * INTO v_option
    FROM public.product_options
    WHERE product_id = v_product.id
      AND (name_ar = v_option_key OR name = v_option_key)
    ORDER BY available_for_direct_sale DESC NULLS LAST
    LIMIT 1;

    -- If matching option exists, also decrement its stock_quantity for legacy consistency
    IF v_option.id IS NOT NULL THEN
      UPDATE public.product_options
         SET stock_quantity = GREATEST(COALESCE(stock_quantity,0) - 1, 0)
       WHERE id = v_option.id;
    END IF;

  ELSE
    -- Pre-order: pick any product in category (not requiring direct stock)
    SELECT p.* INTO v_product FROM public.products p
    WHERE p.category_id = p_category_id
      AND (NOT v_has_whitelist OR p.id = ANY(v_offer.allowed_product_ids))
    ORDER BY random() LIMIT 1;

    IF v_product.id IS NULL THEN RAISE EXCEPTION 'NO_PRODUCT_AVAILABLE'; END IF;

    -- Pick a random preorder-eligible color
    SELECT c INTO v_color
    FROM jsonb_array_elements(COALESCE(v_product.colors::jsonb, '[]'::jsonb)) c
    WHERE COALESCE((c->>'available_for_pre_order')::boolean, true) = true
    ORDER BY random() LIMIT 1;

    -- Pick a random preorder-eligible option (if any)
    SELECT * INTO v_option FROM public.product_options
    WHERE product_id = v_product.id
      AND COALESCE(available_for_pre_order, true) = true
    ORDER BY random() LIMIT 1;
  END IF;

  v_color_name := COALESCE(v_color->>'name_ar', v_color->>'name', v_option.name_ar, v_option.name);
  v_color_image := COALESCE(v_color->>'image_url', v_option.image_url);

  INSERT INTO public.cart_items (
    user_id, product_id, product_option_id, selected_color,
    color_image_url, quantity, sale_type, is_locked
  ) VALUES (
    v_user, v_product.id, v_option.id, v_color_name,
    v_color_image, 1, v_sale_type, true
  ) RETURNING id INTO v_cart_item_id;

  INSERT INTO public.random_filament_orders (
    user_id, cart_item_id, category_id, sale_type,
    product_id, product_option_id, selected_color, price_iqd, offer_id
  ) VALUES (
    v_user, v_cart_item_id, p_category_id, v_sale_type,
    v_product.id, v_option.id, v_color_name, v_offer.price_iqd, v_offer.id
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

-- Update stock summary to read from colors[].option_stocks (V3 model)
CREATE OR REPLACE FUNCTION public.rf_offer_stock_summary(p_offer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT COALESCE(SUM(GREATEST(COALESCE(NULLIF(kv.value,'')::int, 0), 0)), 0)
      INTO v_stock
    FROM public.products p,
         jsonb_array_elements(COALESCE(p.colors::jsonb, '[]'::jsonb)) c,
         jsonb_each_text(COALESCE(c->'option_stocks','{}'::jsonb)) kv
    WHERE p.in_stock = true
      AND COALESCE((c->>'available_for_direct_sale')::boolean, false) = true
      AND (NOT v_has_whitelist OR p.id = ANY(v_offer.allowed_product_ids))
      AND (COALESCE(array_length(v_cat_ids,1),0) = 0 OR p.category_id = ANY(v_cat_ids));
  END IF;

  -- Sales count = every successful random filament order for this offer
  SELECT COUNT(*) INTO v_sales
  FROM public.random_filament_orders
  WHERE offer_id = p_offer_id;

  RETURN jsonb_build_object(
    'direct_stock_total', v_stock,
    'sales_count', v_sales
  );
END;
$function$;