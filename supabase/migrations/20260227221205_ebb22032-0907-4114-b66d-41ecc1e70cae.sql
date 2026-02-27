CREATE OR REPLACE FUNCTION public.deduct_order_stock(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_option_name TEXT;
  v_product_colors JSONB;
  v_updated_colors JSONB;
  v_rows_updated INTEGER;
  v_any_deduction BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_order.order_type != 'direct' THEN
    RETURN;
  END IF;

  IF v_order.stock_deducted IS TRUE THEN
    RETURN;
  END IF;

  FOR v_item IN
    SELECT oi.product_id, oi.product_option_id, oi.quantity, oi.selected_color
    FROM order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.product_id IS NOT NULL
  LOOP
    v_option_name := NULL;
    IF v_item.product_option_id IS NOT NULL THEN
      SELECT name_ar INTO v_option_name FROM product_options WHERE id = v_item.product_option_id;
    END IF;

    IF v_item.selected_color IS NOT NULL AND v_item.product_id IS NOT NULL THEN
      SELECT colors INTO v_product_colors
      FROM products
      WHERE id = v_item.product_id;

      IF v_product_colors IS NOT NULL AND jsonb_typeof(v_product_colors) = 'array' THEN
        SELECT jsonb_agg(
          CASE
            WHEN public.normalize_text_key(c->>'name_ar') = public.normalize_text_key(v_item.selected_color)
              OR public.normalize_text_key(c->>'name') = public.normalize_text_key(v_item.selected_color)
            THEN
              CASE
                WHEN v_option_name IS NOT NULL AND c->'option_stocks' IS NOT NULL THEN
                  COALESCE(
                    (
                      SELECT jsonb_set(
                        jsonb_set(
                          c,
                          ARRAY['option_stocks', os.key],
                          to_jsonb(GREATEST((os.value)::int - v_item.quantity, 0))
                        ),
                        '{in_stock}',
                        CASE
                          WHEN (
                            SELECT COALESCE(SUM(
                              CASE
                                WHEN k.key = os.key THEN GREATEST((k.value)::int - v_item.quantity, 0)
                                ELSE GREATEST((k.value)::int, 0)
                              END
                            ), 0)
                            FROM jsonb_each_text(c->'option_stocks') AS k
                          ) > 0
                          THEN 'true'::jsonb
                          ELSE 'false'::jsonb
                        END
                      )
                      FROM jsonb_each_text(c->'option_stocks') AS os
                      WHERE public.normalize_text_key(os.key) = public.normalize_text_key(v_option_name)
                      LIMIT 1
                    ),
                    c
                  )
                WHEN c->>'stock_quantity' IS NOT NULL THEN
                  jsonb_set(
                    jsonb_set(
                      c,
                      '{stock_quantity}',
                      to_jsonb(GREATEST(COALESCE((c->>'stock_quantity')::int, 0) - v_item.quantity, 0))
                    ),
                    '{in_stock}',
                    CASE
                      WHEN COALESCE((c->>'stock_quantity')::int, 0) - v_item.quantity > 0
                      THEN 'true'::jsonb
                      ELSE 'false'::jsonb
                    END
                  )
                ELSE c
              END
            ELSE c
          END
        )
        INTO v_updated_colors
        FROM jsonb_array_elements(v_product_colors) AS c;

        IF v_updated_colors IS NOT NULL AND v_updated_colors IS DISTINCT FROM v_product_colors THEN
          UPDATE products SET colors = v_updated_colors WHERE id = v_item.product_id;
          v_any_deduction := TRUE;
        END IF;
      END IF;
    END IF;

    IF v_item.product_option_id IS NOT NULL THEN
      UPDATE product_options
      SET stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - v_item.quantity, 0),
          in_stock = CASE WHEN COALESCE(stock_quantity, 0) - v_item.quantity > 0 THEN true ELSE false END
      WHERE id = v_item.product_option_id
        AND stock_quantity IS NOT NULL;

      GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
      IF v_rows_updated > 0 THEN
        v_any_deduction := TRUE;
      END IF;
    END IF;
  END LOOP;

  -- Prevent recursive no-op updates on orders that keep stock_deducted = false
  UPDATE orders
  SET stock_deducted = v_any_deduction
  WHERE id = p_order_id
    AND stock_deducted IS DISTINCT FROM v_any_deduction;
END;
$function$;