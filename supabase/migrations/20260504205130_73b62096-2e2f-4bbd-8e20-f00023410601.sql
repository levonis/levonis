
-- 1. cart_items: add RF columns
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS rf_offer_id uuid REFERENCES public.random_filament_offers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rf_category_id uuid REFERENCES public.categories(id);

-- 2. Update cart_items check constraint to allow RF rows without product_id
ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS check_product_custom_or_bundle;
ALTER TABLE public.cart_items ADD CONSTRAINT check_product_custom_or_bundle CHECK (
  (product_id IS NOT NULL AND custom_request_id IS NULL AND bundle_id IS NULL AND rf_offer_id IS NULL) OR
  (product_id IS NULL AND custom_request_id IS NOT NULL AND bundle_id IS NULL AND rf_offer_id IS NULL) OR
  (product_id IS NULL AND custom_request_id IS NULL AND bundle_id IS NOT NULL AND rf_offer_id IS NULL) OR
  (product_id IS NULL AND custom_request_id IS NULL AND bundle_id IS NULL AND rf_offer_id IS NOT NULL)
);

-- 3. Replace unique index to ignore RF rows; add new unique for RF
DROP INDEX IF EXISTS public.ux_cart_items_non_gift;
CREATE UNIQUE INDEX ux_cart_items_non_gift
  ON public.cart_items (user_id, product_id, product_option_id, selected_color, shipping_option_index, sale_type)
  WHERE is_gift = false AND product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cart_items_rf_unique
  ON public.cart_items (user_id, rf_offer_id, rf_category_id)
  WHERE rf_offer_id IS NOT NULL;

-- 4. order_items: add rf_offer_id
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS rf_offer_id uuid REFERENCES public.random_filament_offers(id);

-- 5. random_filament_orders: relax cart_item_id (allow null + multiple)
ALTER TABLE public.random_filament_orders DROP CONSTRAINT IF EXISTS random_filament_orders_cart_item_id_key;
ALTER TABLE public.random_filament_orders ALTER COLUMN cart_item_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rfo_cart_item ON public.random_filament_orders (cart_item_id);

-- 6. Cleanup any pre-existing unrevealed RF orders so new flow starts clean
DELETE FROM public.random_filament_orders WHERE revealed_at IS NULL AND order_id IS NULL;

-- 7. New RPC: add_random_filament_to_cart
CREATE OR REPLACE FUNCTION public.add_random_filament_to_cart(
  p_category_id uuid,
  p_offer_id uuid,
  p_quantity int
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_settings public.random_filament_settings;
  v_offer public.random_filament_offers;
  v_max_stock int;
  v_existing_id uuid;
  v_other_sale_type text;
  v_summary jsonb;
  v_qty int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
  IF EXISTS (SELECT 1 FROM public.random_filament_bans WHERE user_id = v_user) THEN
    RAISE EXCEPTION 'USER_BANNED';
  END IF;

  SELECT * INTO v_settings FROM public.random_filament_settings LIMIT 1;
  IF NOT v_settings.enabled THEN RAISE EXCEPTION 'SECTION_DISABLED'; END IF;
  IF NOT (p_category_id = ANY(v_settings.category_ids)) THEN
    RAISE EXCEPTION 'CATEGORY_NOT_ALLOWED';
  END IF;

  SELECT * INTO v_offer FROM public.random_filament_offers WHERE id = p_offer_id AND enabled = true;
  IF v_offer.id IS NULL THEN RAISE EXCEPTION 'OFFER_NOT_FOUND'; END IF;
  IF v_offer.price_iqd <= 0 THEN RAISE EXCEPTION 'PRICE_NOT_CONFIGURED'; END IF;

  -- Block conflicting sale_type already in cart
  SELECT sale_type INTO v_other_sale_type
  FROM public.cart_items
  WHERE user_id = v_user AND rf_offer_id IS NOT NULL AND sale_type IS DISTINCT FROM v_offer.sale_type
  LIMIT 1;
  IF v_other_sale_type IS NOT NULL THEN RAISE EXCEPTION 'CONFLICTING_SALE_TYPE'; END IF;

  -- Cap by available stock (direct only)
  IF v_offer.sale_type = 'direct' THEN
    v_summary := public.rf_offer_stock_summary(p_offer_id);
    v_max_stock := COALESCE((v_summary->>'direct_stock_total')::int, 0);
    IF v_max_stock < 1 THEN RAISE EXCEPTION 'NO_STOCK'; END IF;
  ELSE
    v_max_stock := 999999;
  END IF;

  v_qty := LEAST(p_quantity, v_max_stock);

  SELECT id INTO v_existing_id
  FROM public.cart_items
  WHERE user_id = v_user AND rf_offer_id = p_offer_id AND rf_category_id = p_category_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.cart_items
       SET quantity = v_qty, updated_at = now()
     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.cart_items (
      user_id, rf_offer_id, rf_category_id, sale_type, quantity, product_id, is_locked
    ) VALUES (
      v_user, p_offer_id, p_category_id, v_offer.sale_type, v_qty, NULL, false
    ) RETURNING id INTO v_existing_id;
  END IF;

  RETURN jsonb_build_object(
    'cart_item_id', v_existing_id,
    'quantity', v_qty,
    'max_stock', v_max_stock,
    'price_iqd', v_offer.price_iqd
  );
END $$;

GRANT EXECUTE ON FUNCTION public.add_random_filament_to_cart(uuid, uuid, int) TO authenticated;

-- 8. Finalize + reveal: pick product/color/option, deduct stock, create rfo rows
CREATE OR REPLACE FUNCTION public.finalize_and_reveal_rf_for_order(p_order_id uuid)
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
    WHERE oi.order_id = p_order_id
      AND oi.rf_offer_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.random_filament_orders rfo
        WHERE rfo.order_id = p_order_id AND rfo.offer_id = oi.rf_offer_id
      )
    FOR UPDATE
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

    -- Update the order_item with the first picked product so user sees a real product after reveal
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

GRANT EXECUTE ON FUNCTION public.finalize_and_reveal_rf_for_order(uuid) TO authenticated;

-- 9. Update auto_reveal_rf_on_payment to call finalize
CREATE OR REPLACE FUNCTION public.auto_reveal_rf_on_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND COALESCE(OLD.payment_status,'') <> 'paid' THEN
    PERFORM public.finalize_and_reveal_rf_for_order(NEW.id);
  END IF;
  RETURN NEW;
END $$;

-- 10. Update auto_reveal_rf_on_delivery to call finalize
CREATE OR REPLACE FUNCTION public.auto_reveal_rf_on_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.status = 'delivered' AND COALESCE(OLD.status, '') <> 'delivered')
     OR (NEW.user_confirmed_delivery = true AND COALESCE(OLD.user_confirmed_delivery, false) = false)
  THEN
    PERFORM public.finalize_and_reveal_rf_for_order(NEW.id);
  END IF;
  RETURN NEW;
END $$;

-- 11. reveal_random_filament_orders becomes a thin wrapper
CREATE OR REPLACE FUNCTION public.reveal_random_filament_orders(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.orders WHERE id = p_order_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_owner <> v_user AND NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  PERFORM public.finalize_and_reveal_rf_for_order(p_order_id);
END $$;

-- 12. link_random_filament_to_order: no-op (finalize handles ordering); keep callable for back-compat
CREATE OR REPLACE FUNCTION public.link_random_filament_to_order(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- New flow: rfo rows are created by finalize_and_reveal_rf_for_order with order_id already set.
  -- Kept as no-op for backward compatibility with existing callers.
  RETURN;
END $$;

-- 13. Update cart protection triggers
CREATE OR REPLACE FUNCTION public.protect_random_filament_cart_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin_user boolean;
  is_rf boolean;
  has_order boolean;
  v_max int;
  v_summary jsonb;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin') INTO is_admin_user;
  IF is_admin_user THEN RETURN NEW; END IF;

  is_rf := (OLD.rf_offer_id IS NOT NULL)
        OR EXISTS (SELECT 1 FROM public.random_filament_orders WHERE cart_item_id = OLD.id);
  IF NOT is_rf THEN RETURN NEW; END IF;

  has_order := EXISTS (
    SELECT 1 FROM public.random_filament_orders
    WHERE cart_item_id = OLD.id AND (order_id IS NOT NULL OR revealed_at IS NOT NULL)
  );

  IF has_order THEN
    IF NEW.quantity IS DISTINCT FROM OLD.quantity
       OR NEW.product_id IS DISTINCT FROM OLD.product_id
       OR NEW.product_option_id IS DISTINCT FROM OLD.product_option_id
       OR NEW.selected_color IS DISTINCT FROM OLD.selected_color
       OR NEW.sale_type IS DISTINCT FROM OLD.sale_type
       OR NEW.rf_offer_id IS DISTINCT FROM OLD.rf_offer_id
    THEN
      RAISE EXCEPTION 'RANDOM_FILAMENT_LOCKED' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Enforce max stock when increasing quantity for direct-sale RF
  IF NEW.rf_offer_id IS NOT NULL AND NEW.sale_type = 'direct' AND NEW.quantity > OLD.quantity THEN
    v_summary := public.rf_offer_stock_summary(NEW.rf_offer_id);
    v_max := COALESCE((v_summary->>'direct_stock_total')::int, 0);
    IF NEW.quantity > v_max THEN
      RAISE EXCEPTION 'RANDOM_FILAMENT_STOCK_EXCEEDED' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.protect_random_filament_cart_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin_user boolean;
  has_order boolean;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin') INTO is_admin_user;
  IF is_admin_user THEN RETURN OLD; END IF;

  has_order := EXISTS (
    SELECT 1 FROM public.random_filament_orders
    WHERE cart_item_id = OLD.id AND (order_id IS NOT NULL OR revealed_at IS NOT NULL)
  );
  IF has_order THEN
    RAISE EXCEPTION 'RANDOM_FILAMENT_LOCKED' USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END $$;

-- 14. Redirect old create_random_filament_order to new add function (back-compat)
CREATE OR REPLACE FUNCTION public.create_random_filament_order(p_category_id uuid, p_offer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.add_random_filament_to_cart(p_category_id, p_offer_id, 1);
END $$;
