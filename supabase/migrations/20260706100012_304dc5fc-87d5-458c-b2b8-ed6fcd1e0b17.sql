
CREATE OR REPLACE FUNCTION public.purge_oos_direct_cart_items()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item RECORD;
  v_product RECORD;
  v_colors jsonb;
  v_color jsonb;
  v_stocks jsonb;
  v_available numeric;
  v_total numeric;
  v_has_stock_data boolean;
  v_removed jsonb := '[]'::jsonb;
  v_name text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('removed', '[]'::jsonb);
  END IF;

  FOR v_item IN
    SELECT ci.id, ci.product_id, ci.product_option_id, ci.selected_color
    FROM public.cart_items ci
    WHERE ci.user_id = v_user
      AND ci.sale_type = 'direct'
      AND ci.product_id IS NOT NULL
      AND COALESCE(ci.is_locked, false) = false
      AND ci.rf_offer_id IS NULL
      AND ci.bundle_id IS NULL
  LOOP
    SELECT id, name, name_ar, direct_stock, colors
      INTO v_product
    FROM public.products
    WHERE id = v_item.product_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_colors := COALESCE(v_product.colors, '[]'::jsonb);
    v_available := NULL;

    IF jsonb_typeof(v_colors) <> 'array' OR jsonb_array_length(v_colors) = 0 THEN
      IF v_product.direct_stock IS NOT NULL THEN
        v_available := GREATEST(0, v_product.direct_stock);
      END IF;
    ELSIF v_item.selected_color IS NOT NULL AND v_item.selected_color <> '' THEN
      SELECT c INTO v_color
      FROM jsonb_array_elements(v_colors) c
      WHERE COALESCE(c->>'name','') = v_item.selected_color
         OR COALESCE(c->>'name_ar','') = v_item.selected_color
         OR COALESCE(c->>'hex_code','') = v_item.selected_color
      LIMIT 1;

      IF v_color IS NULL THEN
        v_available := 0;
      ELSIF COALESCE((v_color->>'available_for_direct_sale')::boolean, true) = false THEN
        v_available := 0;
      ELSE
        v_stocks := v_color->'option_stocks';
        IF v_stocks IS NOT NULL AND jsonb_typeof(v_stocks) = 'object'
           AND (SELECT count(*) FROM jsonb_object_keys(v_stocks)) > 0 THEN
          IF v_item.product_option_id IS NOT NULL
             AND v_stocks ? v_item.product_option_id::text THEN
            v_available := GREATEST(0, COALESCE((v_stocks->>v_item.product_option_id::text)::numeric, 0));
          ELSE
            SELECT COALESCE(SUM(GREATEST(0, (val)::numeric)), 0)
              INTO v_available
            FROM jsonb_each_text(v_stocks) AS t(key, val);
          END IF;
        ELSIF (v_color->>'stock_quantity') IS NOT NULL THEN
          v_available := GREATEST(0, (v_color->>'stock_quantity')::numeric);
        ELSE
          v_available := NULL;
        END IF;
      END IF;
    ELSE
      v_total := 0;
      v_has_stock_data := false;
      FOR v_color IN SELECT c FROM jsonb_array_elements(v_colors) c LOOP
        IF COALESCE((v_color->>'available_for_direct_sale')::boolean, true) = false THEN
          CONTINUE;
        END IF;
        v_stocks := v_color->'option_stocks';
        IF v_stocks IS NOT NULL AND jsonb_typeof(v_stocks) = 'object'
           AND (SELECT count(*) FROM jsonb_object_keys(v_stocks)) > 0 THEN
          v_has_stock_data := true;
          v_total := v_total + COALESCE((
            SELECT SUM(GREATEST(0, (val)::numeric))
            FROM jsonb_each_text(v_stocks) AS t(key, val)
          ), 0);
        ELSIF (v_color->>'stock_quantity') IS NOT NULL THEN
          v_has_stock_data := true;
          v_total := v_total + GREATEST(0, (v_color->>'stock_quantity')::numeric);
        END IF;
      END LOOP;
      IF v_has_stock_data THEN
        v_available := v_total;
      END IF;
    END IF;

    IF v_available IS NOT NULL AND v_available <= 0 THEN
      v_name := COALESCE(v_product.name_ar, v_product.name, '');
      DELETE FROM public.cart_items WHERE id = v_item.id AND user_id = v_user;
      v_removed := v_removed || jsonb_build_object(
        'id', v_item.id,
        'product_id', v_item.product_id,
        'product_name', v_name
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('removed', v_removed);
END;
$$;

REVOKE ALL ON FUNCTION public.purge_oos_direct_cart_items() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_oos_direct_cart_items() TO authenticated;
