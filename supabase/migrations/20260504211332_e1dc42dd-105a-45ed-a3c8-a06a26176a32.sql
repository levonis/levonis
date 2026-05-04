CREATE OR REPLACE FUNCTION public.finalize_and_reveal_rf_for_order(
  p_order_id uuid,
  p_only_sale_type text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_oi RECORD;
  v_offer public.random_filament_offers;
  v_product public.products;
  v_option public.product_options;
  v_color jsonb;
  v_color_idx int;
  v_option_key text;
  v_color_name text;
  v_color_image text;
  v_pool jsonb;
  v_pick text;
  v_weights jsonb;
  v_pw jsonb;
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
        v_pw := COALESCE(v_weights -> v_product.id::text, '{}'::jsonb);

        LOOP
          SELECT jsonb_agg(jsonb_build_object('k',(idx-1)::text,
                   'w', COALESCE(((v_pw->'colors')->>COALESCE(c->>'name_ar',c->>'name','')) ::double precision, 1.0)))
          INTO v_pool
          FROM jsonb_array_elements(COALESCE(v_product.colors::jsonb,'[]'::jsonb)) WITH ORDINALITY AS t(c, idx)
          WHERE COALESCE((c->>'available_for_direct_sale')::boolean,false)=true
            AND NOT (((idx-1)::text) = ANY(v_tried_colors))
            AND EXISTS (SELECT 1 FROM jsonb_each_text(COALESCE(c->'option_stocks','{}'::jsonb)) kv
                        WHERE COALESCE(NULLIF(kv.value,'')::int,0) > 0);
          v_pick := public._rf_weighted_pick(v_pool);
          IF v_pick IS NULL THEN EXIT; END IF;
          v_color_idx := v_pick::int;
          v_color := (v_product.colors::jsonb) -> v_color_idx;

          SELECT kv.key INTO v_option_key
          FROM jsonb_each_text(COALESCE(v_color->'option_stocks','{}'::jsonb)) kv
          WHERE COALESCE(NULLIF(kv.value,'')::int,0) > 0
          ORDER BY random() LIMIT 1;
          IF v_option_key IS NOT NULL THEN EXIT; END IF;
          v_tried_colors := array_append(v_tried_colors, v_color_idx::text);
        END LOOP;

        IF v_color IS NULL OR v_option_key IS NULL THEN RAISE EXCEPTION 'NO_COLOR_AVAILABLE'; END IF;
        v_current_stock := COALESCE((v_color->'option_stocks'->>v_option_key)::int, 0);
        IF v_current_stock <= 0 THEN RAISE EXCEPTION 'NO_COLOR_AVAILABLE'; END IF;

        v_new_colors := jsonb_set(v_product.colors::jsonb,
          ARRAY[v_color_idx::text,'option_stocks',v_option_key],
          to_jsonb(v_current_stock - 1), false);
        UPDATE public.products SET colors = v_new_colors::jsonb WHERE id = v_product.id;

        SELECT * INTO v_option FROM public.product_options
         WHERE product_id = v_product.id AND (name_ar = v_option_key OR name = v_option_key)
         ORDER BY available_for_direct_sale DESC NULLS LAST LIMIT 1;
        IF v_option.id IS NOT NULL THEN
          UPDATE public.product_options
             SET stock_quantity = GREATEST(COALESCE(stock_quantity,0) - 1, 0)
           WHERE id = v_option.id;
        END IF;
      ELSE
        SELECT jsonb_agg(jsonb_build_object('k', p.id::text,
                 'w', COALESCE(((v_weights -> p.id::text) ->> 'weight')::double precision, 1.0)))
        INTO v_pool
        FROM public.products p
        WHERE (NOT v_has_whitelist OR p.id = ANY(v_offer.allowed_product_ids))
          AND (COALESCE(array_length(v_cat_ids,1),0) = 0 OR p.category_id = ANY(v_cat_ids));
        v_pick := public._rf_weighted_pick(v_pool);
        IF v_pick IS NULL THEN RAISE EXCEPTION 'NO_PRODUCT_AVAILABLE'; END IF;
        SELECT * INTO v_product FROM public.products WHERE id = v_pick::uuid;
        v_pw := COALESCE(v_weights -> v_product.id::text, '{}'::jsonb);

        SELECT jsonb_agg(jsonb_build_object('k',(idx-1)::text,
                 'w', COALESCE(((v_pw->'colors')->>COALESCE(c->>'name_ar',c->>'name','')) ::double precision, 1.0)))
        INTO v_pool
        FROM jsonb_array_elements(COALESCE(v_product.colors::jsonb,'[]'::jsonb)) WITH ORDINALITY AS t(c, idx)
        WHERE COALESCE((c->>'available_for_pre_order')::boolean,true) = true;
        v_pick := public._rf_weighted_pick(v_pool);
        IF v_pick IS NULL THEN RAISE EXCEPTION 'NO_COLOR_AVAILABLE'; END IF;
        v_color_idx := v_pick::int;
        v_color := (v_product.colors::jsonb) -> v_color_idx;

        SELECT jsonb_agg(jsonb_build_object('k', po.id::text,
                 'w', COALESCE(((v_pw->'options')->>COALESCE(po.name_ar, po.name))::double precision, 1.0)))
        INTO v_pool
        FROM public.product_options po
        WHERE po.product_id = v_product.id AND COALESCE(po.available_for_pre_order, true) = true;
        v_pick := public._rf_weighted_pick(v_pool);
        IF v_pick IS NOT NULL THEN
          SELECT * INTO v_option FROM public.product_options WHERE id = v_pick::uuid;
          v_option_key := COALESCE(v_option.name_ar, v_option.name);
        END IF;
      END IF;

      v_color_name := COALESCE(v_color->>'name_ar', v_color->>'name', 'لون مفاجأة');
      v_color_image := COALESCE(v_color->>'image_url', v_color->>'image', NULL);

      INSERT INTO public.random_filament_orders (
        user_id, cart_item_id, order_id, category_id, sale_type,
        product_id, product_option_id, selected_color, price_iqd, offer_id, revealed_at
      ) VALUES (
        v_owner, NULL, p_order_id,
        COALESCE(v_oi.product_id, v_offer.category_id, v_cat_ids[1]),
        v_offer.sale_type,
        v_product.id, v_option.id, v_color_name, v_offer.price_iqd, v_offer.id, now()
      );

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
        selected_color = v_first_color,
        color_image_url = v_first_color_image,
        product_name = COALESCE((SELECT name FROM public.products WHERE id = v_first_product_id), product_name),
        product_name_ar = COALESCE((SELECT name_ar FROM public.products WHERE id = v_first_product_id), product_name_ar)
      WHERE id = v_oi.id;
    END IF;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.finalize_and_reveal_rf_for_order(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.auto_reveal_rf_on_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND COALESCE(OLD.payment_status,'') <> 'paid' THEN
    PERFORM public.finalize_and_reveal_rf_for_order(NEW.id, 'preorder');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.auto_reveal_rf_on_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.status = 'delivered' AND COALESCE(OLD.status, '') <> 'delivered')
     OR (NEW.user_confirmed_delivery = true AND COALESCE(OLD.user_confirmed_delivery, false) = false)
  THEN
    PERFORM public.finalize_and_reveal_rf_for_order(NEW.id, NULL);
  END IF;
  RETURN NEW;
END $$;