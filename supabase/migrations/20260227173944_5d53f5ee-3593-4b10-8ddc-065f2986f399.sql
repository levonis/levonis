
-- Function to cancel an order and restore stock for direct sale items
CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_id uuid,
  p_cancelled_by text DEFAULT 'customer' -- 'customer' or 'admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_result jsonb;
BEGIN
  -- Get the order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الطلب غير موجود');
  END IF;
  
  -- Check if order can be cancelled
  IF v_order.status IN ('cancelled', 'delivered', 'shipped', 'arrived_iraq') THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يمكن إلغاء هذا الطلب في حالته الحالية');
  END IF;
  
  -- For customers: check if order is within 1 hour or not yet "processing"
  IF p_cancelled_by = 'customer' THEN
    -- Can cancel if within 1 hour of creation
    IF v_order.created_at < (now() - interval '1 hour') THEN
      -- After 1 hour, can only cancel if not yet processing
      IF v_order.status NOT IN ('pending', 'confirmed') THEN
        RETURN jsonb_build_object('success', false, 'error', 'انتهت فترة إلغاء الطلب. يمكنك الإلغاء خلال ساعة واحدة فقط أو قبل تجهيز الطلب');
      END IF;
    END IF;
  END IF;
  
  -- For direct sale orders, restore stock
  IF v_order.order_type = 'direct' THEN
    FOR v_item IN 
      SELECT oi.product_id, oi.product_option_id, oi.quantity, oi.selected_color
      FROM order_items oi 
      WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
    LOOP
      -- Restore product option stock if applicable
      IF v_item.product_option_id IS NOT NULL THEN
        UPDATE product_options 
        SET stock_quantity = COALESCE(stock_quantity, 0) + v_item.quantity,
            in_stock = true
        WHERE id = v_item.product_option_id
          AND stock_quantity IS NOT NULL;
      END IF;
      
      -- Restore color stock if applicable
      IF v_item.selected_color IS NOT NULL AND v_item.product_id IS NOT NULL THEN
        UPDATE products 
        SET colors = (
          SELECT jsonb_agg(
            CASE 
              WHEN (c->>'name_ar' = v_item.selected_color OR c->>'name' = v_item.selected_color) 
                   AND c->>'stock_quantity' IS NOT NULL
              THEN jsonb_set(
                jsonb_set(c, '{stock_quantity}', to_jsonb((COALESCE((c->>'stock_quantity')::int, 0) + v_item.quantity))),
                '{in_stock}', 'true'::jsonb
              )
              ELSE c
            END
          )
          FROM jsonb_array_elements(colors) AS c
        )
        WHERE id = v_item.product_id AND colors IS NOT NULL;
      END IF;
    END LOOP;
  END IF;
  
  -- If order was paid via wallet, refund the paid amount
  IF v_order.paid_amount > 0 AND v_order.payment_status != 'cod' THEN
    UPDATE user_wallets 
    SET balance = balance + v_order.paid_amount,
        updated_at = now()
    WHERE user_id = v_order.user_id;
  END IF;
  
  -- Update order status
  UPDATE orders 
  SET status = 'cancelled',
      cancelled_at = now(),
      internal_notes = COALESCE(internal_notes, '') || 
        E'\n' || '❌ تم الإلغاء بواسطة: ' || p_cancelled_by || ' - ' || now()::text,
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
