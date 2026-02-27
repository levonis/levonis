-- Normalize text helper for matching option/color keys safely
CREATE OR REPLACE FUNCTION public.normalize_text_key(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(trim(lower(coalesce(p_text, ''))), '\s+', ' ', 'g');
$$;

-- Robust stock deduction for direct-sale orders
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

  UPDATE orders
  SET stock_deducted = v_any_deduction
  WHERE id = p_order_id;
END;
$function$;

-- Improve fallback trigger so it does not mark stock as deducted unless deduction actually happened
CREATE OR REPLACE FUNCTION public.auto_deduct_stock_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_deducted boolean;
BEGIN
  IF NEW.order_type = 'direct'
     AND NEW.stock_deducted IS NOT TRUE
     AND EXISTS (SELECT 1 FROM order_items WHERE order_id = NEW.id)
  THEN
    PERFORM public.deduct_order_stock(NEW.id);

    SELECT stock_deducted INTO v_deducted
    FROM orders
    WHERE id = NEW.id;

    NEW.stock_deducted := COALESCE(v_deducted, false);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_deduct_stock ON public.orders;
CREATE TRIGGER trg_auto_deduct_stock
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.stock_deducted IS NOT TRUE AND NEW.stock_deducted IS NOT TRUE AND NEW.order_type = 'direct')
  EXECUTE FUNCTION public.auto_deduct_stock_on_order();

-- Restore color option_stocks on cancellation (direct-sale only, if stock was deducted)
CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_id uuid,
  p_cancelled_by text DEFAULT 'customer'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      SELECT oi.product_id, oi.product_option_id, oi.quantity, oi.selected_color
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
          SELECT name_ar INTO v_option_name
          FROM product_options
          WHERE id = v_item.product_option_id;

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
$$;