CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid, p_cancelled_by text DEFAULT 'customer'::text)
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

  IF v_order.status IN ('cancelled', 'delivered', 'shipped', 'arrived_iraq') THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يمكن إلغاء هذا الطلب في حالته الحالية');
  END IF;

  IF p_cancelled_by = 'customer' THEN
    IF v_order.created_at < (now() - interval '1 hour') THEN
      IF v_order.status NOT IN ('pending', 'confirmed') THEN
        RETURN jsonb_build_object('success', false, 'error', 'انتهت فترة إلغاء الطلب. يمكنك الإلغاء خلال ساعة واحدة فقط أو قبل تجهيز الطلب');
      END IF;
    END IF;
  END IF;

  IF v_order.order_type = 'direct' AND COALESCE(v_order.stock_deducted, false) IS TRUE THEN
    FOR v_item IN
      SELECT oi.product_id, oi.product_option_id, oi.quantity, oi.selected_color, oi.selected_option
      FROM order_items oi
      WHERE oi.order_id = p_order_id
        AND oi.product_id IS NOT NULL
    LOOP
      IF v_item.product_option_id IS NOT NULL THEN
        UPDATE product_options
        SET stock_quantity = COALESCE(stock_quantity, 0) + v_item.quantity,
            in_stock = true
        WHERE id = v_item.product_option_id
          AND stock_quantity IS NOT NULL;
      END IF;

      IF v_item.selected_color IS NOT NULL AND v_item.product_id IS NOT NULL THEN
        SELECT colors INTO v_product_colors
        FROM products
        WHERE id = v_item.product_id;

        IF v_product_colors IS NOT NULL AND jsonb_typeof(v_product_colors) = 'array' THEN
          v_option_name := NULL;

          IF v_item.product_option_id IS NOT NULL THEN
            SELECT name_ar INTO v_option_name
            FROM product_options
            WHERE id = v_item.product_option_id;
          END IF;

          IF v_option_name IS NULL AND v_item.selected_option IS NOT NULL THEN
            v_option_name := v_item.selected_option;
          END IF;

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
                            to_jsonb((os.value)::int + v_item.quantity)
                          ),
                          '{in_stock}',
                          'true'::jsonb
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
                        to_jsonb(COALESCE((c->>'stock_quantity')::int, 0) + v_item.quantity)
                      ),
                      '{in_stock}',
                      'true'::jsonb
                    )
                  ELSE c
                END
              ELSE c
            END
          )
          INTO v_updated_colors
          FROM jsonb_array_elements(v_product_colors) AS c;

          IF v_updated_colors IS NOT NULL THEN
            UPDATE products
            SET colors = v_updated_colors
            WHERE id = v_item.product_id;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF v_order.paid_amount > 0 AND v_order.payment_status != 'cod' THEN
    UPDATE user_wallets
    SET balance = balance + v_order.paid_amount,
        updated_at = now()
    WHERE user_id = v_order.user_id;
  END IF;

  UPDATE orders
  SET status = 'cancelled',
      cancelled_at = now(),
      stock_deducted = false,
      internal_notes = COALESCE(internal_notes, '') || E'\n' || '❌ تم الإلغاء بواسطة: ' || p_cancelled_by || ' - ' || now()::text,
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_number', v_order.order_number,
    'order_type', v_order.order_type,
    'refunded_amount', CASE WHEN v_order.paid_amount > 0 AND v_order.payment_status != 'cod' THEN v_order.paid_amount ELSE 0 END
  );
END;
$function$;