
-- 1. Fix deduct_order_stock: add direct_stock update
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
  IF NOT FOUND THEN RETURN; END IF;
  IF v_order.order_type != 'direct' THEN RETURN; END IF;
  IF v_order.stock_deducted IS TRUE THEN RETURN; END IF;

  FOR v_item IN
    SELECT oi.product_id, oi.product_option_id, oi.quantity, oi.selected_color, oi.selected_option
    FROM order_items oi
    WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
  LOOP
    v_option_name := NULL;
    IF v_item.product_option_id IS NOT NULL THEN
      SELECT name_ar INTO v_option_name FROM product_options WHERE id = v_item.product_option_id;
    END IF;
    IF v_option_name IS NULL AND v_item.selected_option IS NOT NULL THEN
      v_option_name := v_item.selected_option;
    END IF;

    IF v_item.selected_color IS NOT NULL AND v_item.product_id IS NOT NULL THEN
      SELECT colors INTO v_product_colors FROM products WHERE id = v_item.product_id;

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
                        jsonb_set(c,
                          ARRAY['option_stocks', os.key],
                          to_jsonb(GREATEST((os.value)::int - v_item.quantity, 0))
                        ),
                        '{in_stock}',
                        CASE
                          WHEN (SELECT COALESCE(SUM(
                            CASE WHEN k.key = os.key THEN GREATEST((k.value)::int - v_item.quantity, 0)
                                 ELSE GREATEST((k.value)::int, 0) END
                          ), 0) FROM jsonb_each_text(c->'option_stocks') AS k) > 0
                          THEN 'true'::jsonb ELSE 'false'::jsonb
                        END
                      )
                      FROM jsonb_each_text(c->'option_stocks') AS os
                      WHERE public.normalize_text_key(os.key) = public.normalize_text_key(v_option_name)
                      LIMIT 1
                    ), c
                  )
                WHEN c->>'stock_quantity' IS NOT NULL THEN
                  jsonb_set(
                    jsonb_set(c, '{stock_quantity}',
                      to_jsonb(GREATEST(COALESCE((c->>'stock_quantity')::int, 0) - v_item.quantity, 0))
                    ),
                    '{in_stock}',
                    CASE WHEN COALESCE((c->>'stock_quantity')::int, 0) - v_item.quantity > 0
                      THEN 'true'::jsonb ELSE 'false'::jsonb END
                  )
                ELSE c
              END
            ELSE c
          END
        ) INTO v_updated_colors
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
      WHERE id = v_item.product_option_id AND stock_quantity IS NOT NULL;
      GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
      IF v_rows_updated > 0 THEN v_any_deduction := TRUE; END IF;
    END IF;

    -- NEW: Always update direct_stock on the product
    UPDATE products
    SET direct_stock = GREATEST(0, COALESCE(direct_stock, 0) - v_item.quantity)
    WHERE id = v_item.product_id;
    v_any_deduction := TRUE;

  END LOOP;

  UPDATE orders
  SET stock_deducted = v_any_deduction
  WHERE id = p_order_id AND stock_deducted IS DISTINCT FROM v_any_deduction;
END;
$function$;

-- 2. Fix cancel_order: add direct_stock restoration
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid, p_cancelled_by text DEFAULT 'admin'::text)
 RETURNS jsonb
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
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الطلب غير موجود');
  END IF;

  IF p_cancelled_by = 'admin' THEN
    IF v_order.status = 'cancelled' THEN
      RETURN jsonb_build_object('success', false, 'error', 'الطلب ملغي بالفعل');
    END IF;
  ELSE
    IF v_order.status IN ('cancelled', 'delivered', 'shipped', 'arrived_iraq') THEN
      RETURN jsonb_build_object('success', false, 'error', 'لا يمكن إلغاء هذا الطلب في حالته الحالية');
    END IF;
    IF v_order.created_at < (now() - interval '1 hour') THEN
      IF v_order.status NOT IN ('pending', 'confirmed') THEN
        RETURN jsonb_build_object('success', false, 'error', 'انتهت فترة إلغاء الطلب. يمكنك الإلغاء خلال ساعة واحدة فقط أو قبل تجهيز الطلب');
      END IF;
    END IF;
  END IF;

  -- Restore stock if it was deducted
  IF v_order.order_type = 'direct' AND COALESCE(v_order.stock_deducted, false) IS TRUE THEN
    FOR v_item IN
      SELECT oi.product_id, oi.product_option_id, oi.quantity, oi.selected_color, oi.selected_option
      FROM order_items oi
      WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
    LOOP
      IF v_item.product_option_id IS NOT NULL THEN
        UPDATE product_options
        SET stock_quantity = COALESCE(stock_quantity, 0) + v_item.quantity, in_stock = true
        WHERE id = v_item.product_option_id AND stock_quantity IS NOT NULL;
      END IF;

      v_option_name := NULL;
      IF v_item.product_option_id IS NOT NULL THEN
        SELECT name_ar INTO v_option_name FROM product_options WHERE id = v_item.product_option_id;
      END IF;
      IF v_option_name IS NULL AND v_item.selected_option IS NOT NULL THEN
        v_option_name := v_item.selected_option;
      END IF;

      IF v_item.selected_color IS NOT NULL AND v_item.product_id IS NOT NULL THEN
        SELECT colors INTO v_product_colors FROM products WHERE id = v_item.product_id;

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
                          jsonb_set(c,
                            ARRAY['option_stocks', os.key],
                            to_jsonb((os.value)::int + v_item.quantity)
                          ),
                          '{in_stock}', 'true'::jsonb
                        )
                        FROM jsonb_each_text(c->'option_stocks') AS os
                        WHERE public.normalize_text_key(os.key) = public.normalize_text_key(v_option_name)
                        LIMIT 1
                      ), c
                    )
                  WHEN c->>'stock_quantity' IS NOT NULL THEN
                    jsonb_set(
                      jsonb_set(c, '{stock_quantity}',
                        to_jsonb(COALESCE((c->>'stock_quantity')::int, 0) + v_item.quantity)
                      ),
                      '{in_stock}', 'true'::jsonb
                    )
                  ELSE c
                END
              ELSE c
            END
          ) INTO v_updated_colors
          FROM jsonb_array_elements(v_product_colors) AS c;

          IF v_updated_colors IS NOT NULL THEN
            UPDATE products SET colors = v_updated_colors WHERE id = v_item.product_id;
          END IF;
        END IF;
      END IF;

      -- NEW: Restore direct_stock on the product
      UPDATE products
      SET direct_stock = COALESCE(direct_stock, 0) + v_item.quantity
      WHERE id = v_item.product_id;

    END LOOP;
  END IF;

  -- Refund wallet if paid
  IF v_order.paid_amount > 0 AND v_order.payment_status != 'cod' THEN
    UPDATE user_wallets
    SET balance = balance + v_order.paid_amount, updated_at = now()
    WHERE user_id = v_order.user_id;
  END IF;

  UPDATE orders
  SET status = 'cancelled', cancelled_at = now(), stock_deducted = false, updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- 3. Rewrite admin_adjust_order_inventory: flat option_stocks + normalize matching
DROP FUNCTION IF EXISTS public.admin_adjust_order_inventory(uuid, uuid, text, integer);

CREATE OR REPLACE FUNCTION public.admin_adjust_order_inventory(
  p_product_id uuid,
  p_option_name text DEFAULT NULL,
  p_selected_color text DEFAULT NULL,
  p_quantity_change integer DEFAULT 0
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_product_colors JSONB;
  v_updated_colors JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  -- Always update direct_stock
  UPDATE products
  SET direct_stock = GREATEST(0, COALESCE(direct_stock, 0) + p_quantity_change)
  WHERE id = p_product_id;

  -- If color specified, update color-level option_stocks (flat object format)
  IF p_selected_color IS NOT NULL THEN
    SELECT colors INTO v_product_colors FROM products WHERE id = p_product_id;

    IF v_product_colors IS NOT NULL AND jsonb_typeof(v_product_colors) = 'array' THEN
      SELECT jsonb_agg(
        CASE
          WHEN public.normalize_text_key(c->>'name_ar') = public.normalize_text_key(p_selected_color)
            OR public.normalize_text_key(c->>'name') = public.normalize_text_key(p_selected_color)
          THEN
            CASE
              WHEN p_option_name IS NOT NULL AND c->'option_stocks' IS NOT NULL THEN
                COALESCE(
                  (
                    SELECT jsonb_set(
                      jsonb_set(c,
                        ARRAY['option_stocks', os.key],
                        to_jsonb(GREATEST(0, (os.value)::int + p_quantity_change))
                      ),
                      '{in_stock}',
                      CASE
                        WHEN (SELECT COALESCE(SUM(
                          CASE WHEN k.key = os.key THEN GREATEST((k.value)::int + p_quantity_change, 0)
                               ELSE GREATEST((k.value)::int, 0) END
                        ), 0) FROM jsonb_each_text(c->'option_stocks') AS k) > 0
                        THEN 'true'::jsonb ELSE 'false'::jsonb
                      END
                    )
                    FROM jsonb_each_text(c->'option_stocks') AS os
                    WHERE public.normalize_text_key(os.key) = public.normalize_text_key(p_option_name)
                    LIMIT 1
                  ), c
                )
              WHEN c->>'stock_quantity' IS NOT NULL THEN
                jsonb_set(
                  jsonb_set(c, '{stock_quantity}',
                    to_jsonb(GREATEST(0, COALESCE((c->>'stock_quantity')::int, 0) + p_quantity_change))
                  ),
                  '{in_stock}',
                  CASE WHEN COALESCE((c->>'stock_quantity')::int, 0) + p_quantity_change > 0
                    THEN 'true'::jsonb ELSE 'false'::jsonb END
                )
              ELSE c
            END
          ELSE c
        END
      ) INTO v_updated_colors
      FROM jsonb_array_elements(v_product_colors) AS c;

      IF v_updated_colors IS NOT NULL THEN
        UPDATE products SET colors = v_updated_colors WHERE id = p_product_id;
      END IF;
    END IF;
  END IF;
END;
$function$;
