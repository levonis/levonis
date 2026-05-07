
CREATE OR REPLACE FUNCTION public.finalize_and_reveal_rf_for_order(p_order_id uuid, p_only_sale_type text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_oi RECORD;
  v_offer public.random_filament_offers;
  v_product public.products;
  v_option public.product_options;
  v_color jsonb;
  v_color_idx int;
  v_option_key text;
  v_option_id uuid;
  v_color_name text;
  v_color_image text;
  v_pool jsonb;
  v_pick text;
  v_weights jsonb;
  v_has_whitelist boolean;
  v_unit int;
  v_first boolean;
  v_first_product_id uuid;
  v_first_option_id uuid;
  v_first_color text;
  v_first_color_image text;
  v_current_stock int;
  v_new_colors jsonb;
  v_tried_colors text[];
  v_cat_ids uuid[];
  v_any_revealed boolean := false;
BEGIN
  SELECT user_id INTO v_owner FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_owner IS NULL THEN RETURN; END IF;

  FOR v_oi IN
    SELECT oi.* FROM public.order_items oi
    JOIN public.random_filament_offers ro ON ro.id = oi.rf_offer_id
    WHERE oi.order_id = p_order_id
      AND oi.rf_offer_id IS NOT NULL
      AND (p_only_sale_type IS NULL OR ro.sale_type = p_only_sale_type)
      AND NOT EXISTS (
        SELECT 1 FROM public.random_filament_orders rfo
        WHERE rfo.order_id = p_order_id AND rfo.offer_id = oi.rf_offer_id
      )
    FOR UPDATE OF oi
  LOOP
    SELECT * INTO v_offer FROM public.random_filament_offers WHERE id = v_oi.rf_offer_id;
    IF v_offer.id IS NULL THEN CONTINUE; END IF;
    v_has_whitelist := COALESCE(array_length(v_offer.allowed_product_ids, 1), 0) > 0;
    v_weights := COALESCE(v_offer.product_weights, '{}'::jsonb);
    v_cat_ids := COALESCE(NULLIF(v_offer.category_ids, '{}'),
      CASE WHEN v_offer.category_id IS NOT NULL THEN ARRAY[v_offer.category_id] ELSE '{}'::uuid[] END);
    v_first := true;
    v_first_product_id := NULL;

    FOR v_unit IN 1..v_oi.quantity LOOP
      v_color := NULL;
      v_option_key := NULL;
      v_option_id := NULL;
      v_tried_colors := ARRAY[]::text[];

      IF v_offer.sale_type = 'direct' THEN
        SELECT jsonb_agg(jsonb_build_object('k', p.id::text,
                 'w', COALESCE(((v_weights -> p.id::text) ->> 'weight')::double precision, 1.0)))
        INTO v_pool
        FROM public.products p
        WHERE p.in_stock = true
          AND (NOT v_has_whitelist OR p.id = ANY(v_offer.allowed_product_ids))
          AND (COALESCE(array_length(v_cat_ids,1),0) = 0 OR p.category_id = ANY(v_cat_ids))
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(p.colors::jsonb,'[]'::jsonb)) c
            WHERE COALESCE((c->>'available_for_direct_sale')::boolean,false)=true
              AND EXISTS (SELECT 1 FROM jsonb_each_text(COALESCE(c->'option_stocks','{}'::jsonb)) kv
                          WHERE COALESCE(NULLIF(kv.value,'')::int,0) > 0)
          );
        v_pick := public._rf_weighted_pick(v_pool);
        IF v_pick IS NULL THEN RAISE EXCEPTION 'NO_PRODUCT_AVAILABLE'; END IF;
        SELECT * INTO v_product FROM public.products WHERE id = v_pick::uuid FOR UPDATE;

        LOOP
          SELECT c, (idx-1) INTO v_color, v_color_idx
          FROM jsonb_array_elements(COALESCE(v_product.colors::jsonb,'[]'::jsonb)) WITH ORDINALITY AS t(c, idx)
          WHERE COALESCE((c->>'available_for_direct_sale')::boolean,false)=true
            AND NOT (COALESCE(c->>'name', c->>'name_ar', '') = ANY(v_tried_colors))
            AND EXISTS (SELECT 1 FROM jsonb_each_text(COALESCE(c->'option_stocks','{}'::jsonb)) kv
                        WHERE COALESCE(NULLIF(kv.value,'')::int,0) > 0)
          ORDER BY random() LIMIT 1;
          IF v_color IS NULL THEN RAISE EXCEPTION 'NO_COLOR_AVAILABLE'; END IF;

          SELECT kv.key INTO v_option_key
          FROM jsonb_each_text(COALESCE(v_color->'option_stocks','{}'::jsonb)) kv
          WHERE COALESCE(NULLIF(kv.value,'')::int,0) > 0
          ORDER BY random() LIMIT 1;
          EXIT WHEN v_option_key IS NOT NULL;
          v_tried_colors := array_append(v_tried_colors, COALESCE(v_color->>'name', v_color->>'name_ar', ''));
        END LOOP;

        v_option_id := NULL;
        BEGIN
          v_option_id := v_option_key::uuid;
        EXCEPTION WHEN others THEN
          v_option_id := NULL;
        END;

        IF v_option_id IS NOT NULL THEN
          SELECT * INTO v_option FROM public.product_options WHERE id = v_option_id;
        ELSE
          v_option := NULL;
        END IF;

        IF v_option.id IS NULL THEN
          SELECT * INTO v_option FROM public.product_options
          WHERE product_id = v_product.id
            AND (name = v_option_key OR name_ar = v_option_key
                 OR trim(name) = trim(v_option_key) OR trim(name_ar) = trim(v_option_key))
          ORDER BY (name_ar = v_option_key) DESC, (name = v_option_key) DESC
          LIMIT 1;
        END IF;

        IF v_option.id IS NULL THEN
          RAISE EXCEPTION 'OPTION_NOT_FOUND: % for product %', v_option_key, v_product.id;
        END IF;

        v_color_name := COALESCE(v_color->>'name_ar', v_color->>'name', '');
        v_color_image := COALESCE(v_color->>'image_url', v_color->>'image', NULL);

        v_current_stock := COALESCE(NULLIF((v_color->'option_stocks'->>v_option_key),'')::int, 0);
        IF v_current_stock <= 0 THEN RAISE EXCEPTION 'OUT_OF_STOCK'; END IF;

        v_new_colors := jsonb_set(
          v_product.colors::jsonb,
          ARRAY[v_color_idx::text, 'option_stocks', v_option_key],
          to_jsonb((v_current_stock - 1)::text)
        );
        UPDATE public.products SET colors = v_new_colors WHERE id = v_product.id;

        INSERT INTO public.random_filament_orders(user_id, order_id, category_id, sale_type, product_id, product_option_id, selected_color, price_iqd, revealed_at, offer_id)
        VALUES (v_owner, p_order_id, v_product.category_id, 'direct', v_product.id, v_option.id, v_color_name, v_offer.price_iqd, now(), v_offer.id);
        v_any_revealed := true;
      ELSE
        CONTINUE;
      END IF;

      IF v_first THEN
        v_first := false;
        v_first_product_id := v_product.id;
        v_first_option_id := v_option.id;
        v_first_color := v_color_name;
        v_first_color_image := v_color_image;
      END IF;
    END LOOP;

    IF v_first_product_id IS NOT NULL THEN
      UPDATE public.order_items SET
        product_id = v_first_product_id,
        product_option_id = v_first_option_id,
        selected_option = COALESCE((SELECT name_ar FROM public.product_options WHERE id = v_first_option_id), (SELECT name FROM public.product_options WHERE id = v_first_option_id), selected_option),
        selected_color = v_first_color,
        color_image_url = v_first_color_image,
        product_name = COALESCE((SELECT name FROM public.products WHERE id = v_first_product_id), product_name),
        product_name_ar = COALESCE((SELECT name_ar FROM public.products WHERE id = v_first_product_id), product_name_ar)
      WHERE id = v_oi.id;
    END IF;
  END LOOP;

  -- Mark order as stock-deducted so cancellation correctly restores inventory
  IF v_any_revealed THEN
    UPDATE public.orders SET stock_deducted = true WHERE id = p_order_id AND COALESCE(stock_deducted, false) = false;
  END IF;
END $function$;
