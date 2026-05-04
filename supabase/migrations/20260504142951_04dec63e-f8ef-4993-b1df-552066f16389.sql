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
  v_weights jsonb;
  v_pw jsonb;
  v_pool jsonb;
  v_pick text;
  v_pick_id uuid;
  v_option_keys text[];
  v_tried_options text[] := ARRAY[]::text[];
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
  v_weights := COALESCE(v_offer.product_weights, '{}'::jsonb);

  IF v_sale_type = 'direct' THEN
    -- 1) Pick a PRODUCT that has at least one option with at least one color in stock
    SELECT jsonb_agg(jsonb_build_object('k', p.id::text,
             'w', COALESCE(((v_weights -> p.id::text) ->> 'weight')::double precision, 1.0)))
    INTO v_pool
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
      );
    v_pick := public._rf_weighted_pick(v_pool);
    IF v_pick IS NULL THEN RAISE EXCEPTION 'NO_PRODUCT_AVAILABLE'; END IF;
    v_pick_id := v_pick::uuid;

    SELECT * INTO v_product FROM public.products WHERE id = v_pick_id FOR UPDATE;
    IF v_product.id IS NULL THEN RAISE EXCEPTION 'NO_PRODUCT_AVAILABLE'; END IF;

    v_pw := COALESCE(v_weights -> v_product.id::text, '{}'::jsonb);

    -- 2) OPTION-FIRST: try options one by one. For each option, check if any color
    --    (available_for_direct_sale=true) has stock_quantity > 0 for THAT option key.
    --    If yes → pick a color weighted. If not → fall back to next option.
    LOOP
      -- Build pool of remaining option keys (across all eligible colors), excluding tried ones
      SELECT jsonb_agg(jsonb_build_object(
               'k', kv.key,
               'w', COALESCE(((v_pw -> 'options') ->> kv.key)::double precision, 1.0)))
      INTO v_pool
      FROM (
        SELECT DISTINCT kv2.key
        FROM jsonb_array_elements(COALESCE(v_product.colors::jsonb, '[]'::jsonb)) c,
             jsonb_each_text(COALESCE(c->'option_stocks','{}'::jsonb)) kv2
        WHERE COALESCE((c->>'available_for_direct_sale')::boolean, false) = true
          AND COALESCE(NULLIF(kv2.value,'')::int, 0) > 0
          AND NOT (kv2.key = ANY(v_tried_options))
      ) kv;

      v_pick := public._rf_weighted_pick(v_pool);
      EXIT WHEN v_pick IS NULL;
      v_option_key := v_pick;

      -- Build pool of colors that have stock > 0 for this option key
      SELECT jsonb_agg(jsonb_build_object(
               'k', (idx - 1)::text,
               'w', COALESCE(((v_pw -> 'colors') ->> COALESCE(c->>'name_ar', c->>'name', ''))::double precision, 1.0)))
      INTO v_pool
      FROM jsonb_array_elements(COALESCE(v_product.colors::jsonb, '[]'::jsonb))
        WITH ORDINALITY AS t(c, idx)
      WHERE COALESCE((c->>'available_for_direct_sale')::boolean, false) = true
        AND COALESCE(NULLIF((c->'option_stocks'->>v_option_key),'')::int, 0) > 0;

      v_pick := public._rf_weighted_pick(v_pool);
      IF v_pick IS NOT NULL THEN
        v_color_idx := v_pick::int;
        v_color := (v_product.colors::jsonb) -> v_color_idx;
        EXIT;
      END IF;

      -- No color has stock for this option → mark tried, try another option
      v_tried_options := array_append(v_tried_options, v_option_key);
      v_option_key := NULL;
    END LOOP;

    IF v_option_key IS NULL OR v_color IS NULL THEN
      RAISE EXCEPTION 'NO_COLOR_AVAILABLE';
    END IF;

    v_current_stock := COALESCE((v_color->'option_stocks'->>v_option_key)::int, 0);
    IF v_current_stock <= 0 THEN RAISE EXCEPTION 'NO_COLOR_AVAILABLE'; END IF;

    v_new_colors := jsonb_set(
      v_product.colors::jsonb,
      ARRAY[v_color_idx::text, 'option_stocks', v_option_key],
      to_jsonb(v_current_stock - 1),
      false
    );
    UPDATE public.products SET colors = v_new_colors::jsonb WHERE id = v_product.id;

    SELECT * INTO v_option
    FROM public.product_options
    WHERE product_id = v_product.id
      AND (name_ar = v_option_key OR name = v_option_key)
    ORDER BY available_for_direct_sale DESC NULLS LAST
    LIMIT 1;

    IF v_option.id IS NOT NULL THEN
      UPDATE public.product_options
         SET stock_quantity = GREATEST(COALESCE(stock_quantity,0) - 1, 0)
       WHERE id = v_option.id;
    END IF;

  ELSE
    -- Pre-order branch: weighted product pick
    SELECT jsonb_agg(jsonb_build_object('k', p.id::text,
             'w', COALESCE(((v_weights -> p.id::text) ->> 'weight')::double precision, 1.0)))
    INTO v_pool
    FROM public.products p
    WHERE p.category_id = p_category_id
      AND (NOT v_has_whitelist OR p.id = ANY(v_offer.allowed_product_ids));
    v_pick := public._rf_weighted_pick(v_pool);
    IF v_pick IS NULL THEN RAISE EXCEPTION 'NO_PRODUCT_AVAILABLE'; END IF;

    SELECT * INTO v_product FROM public.products WHERE id = v_pick::uuid;
    IF v_product.id IS NULL THEN RAISE EXCEPTION 'NO_PRODUCT_AVAILABLE'; END IF;

    v_pw := COALESCE(v_weights -> v_product.id::text, '{}'::jsonb);

    SELECT jsonb_agg(jsonb_build_object(
             'k', (idx - 1)::text,
             'w', COALESCE(((v_pw -> 'colors') ->> COALESCE(c->>'name_ar', c->>'name', ''))::double precision, 1.0)))
    INTO v_pool
    FROM jsonb_array_elements(COALESCE(v_product.colors::jsonb, '[]'::jsonb))
      WITH ORDINALITY AS t(c, idx)
    WHERE COALESCE((c->>'available_for_pre_order')::boolean, true) = true;
    v_pick := public._rf_weighted_pick(v_pool);
    IF v_pick IS NULL THEN RAISE EXCEPTION 'NO_COLOR_AVAILABLE'; END IF;
    v_color_idx := v_pick::int;
    v_color := (v_product.colors::jsonb) -> v_color_idx;

    SELECT jsonb_agg(jsonb_build_object('k', po.id::text,
             'w', COALESCE(((v_pw -> 'options') ->> COALESCE(po.name_ar, po.name)) ::double precision, 1.0)))
    INTO v_pool
    FROM public.product_options po
    WHERE po.product_id = v_product.id
      AND COALESCE(po.available_for_pre_order, true) = true;
    v_pick := public._rf_weighted_pick(v_pool);
    IF v_pick IS NOT NULL THEN
      SELECT * INTO v_option FROM public.product_options WHERE id = v_pick::uuid;
      v_option_key := COALESCE(v_option.name_ar, v_option.name);
    END IF;
  END IF;

  v_color_name := COALESCE(v_color->>'name_ar', v_color->>'name', 'لون مفاجأة');
  v_color_image := COALESCE(v_color->>'image_url', v_color->>'image', NULL);

  -- Insert cart item (locked, hidden details until delivery)
  INSERT INTO public.cart_items (
    user_id, product_id, option_id, quantity, price,
    selected_color, selected_color_image,
    is_locked, is_random_filament, sale_type
  ) VALUES (
    v_user, v_product.id, v_option.id, 1, v_offer.price_iqd,
    v_color_name, v_color_image,
    true, true, v_sale_type
  )
  RETURNING id INTO v_cart_item_id;

  INSERT INTO public.random_filament_orders (
    user_id, offer_id, category_id, product_id, option_id,
    selected_color, selected_color_image, price_iqd, cart_item_id, sale_type
  ) VALUES (
    v_user, v_offer.id, p_category_id, v_product.id, v_option.id,
    v_color_name, v_color_image, v_offer.price_iqd, v_cart_item_id, v_sale_type
  )
  RETURNING id INTO v_rfo_id;

  RETURN jsonb_build_object('success', true, 'cart_item_id', v_cart_item_id, 'rfo_id', v_rfo_id);
END;
$function$;