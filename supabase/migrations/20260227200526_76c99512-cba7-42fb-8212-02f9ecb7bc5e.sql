
CREATE OR REPLACE FUNCTION public.deduct_order_stock(p_order_id UUID)
RETURNS void AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_option_name TEXT;
  v_updated_colors JSONB;
BEGIN
  -- Get the order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Only deduct for direct sale orders
  IF v_order.order_type != 'direct' THEN
    RETURN;
  END IF;
  
  FOR v_item IN 
    SELECT oi.product_id, oi.product_option_id, oi.quantity, oi.selected_color
    FROM order_items oi 
    WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
  LOOP
    -- Get option name if applicable
    v_option_name := NULL;
    IF v_item.product_option_id IS NOT NULL THEN
      SELECT name_ar INTO v_option_name FROM product_options WHERE id = v_item.product_option_id;
    END IF;

    -- Deduct from colors -> option_stocks
    IF v_item.selected_color IS NOT NULL AND v_item.product_id IS NOT NULL THEN
      SELECT jsonb_agg(
        CASE 
          WHEN (c->>'name_ar' = v_item.selected_color OR c->>'name' = v_item.selected_color)
          THEN
            CASE
              -- If option_stocks exists and has the option name, deduct from it
              WHEN v_option_name IS NOT NULL AND c->'option_stocks' IS NOT NULL AND c->'option_stocks'->v_option_name IS NOT NULL
              THEN jsonb_set(
                c,
                ARRAY['option_stocks', v_option_name],
                to_jsonb(GREATEST(COALESCE((c->'option_stocks'->>v_option_name)::int, 0) - v_item.quantity, 0))
              )
              -- If stock_quantity exists (legacy), deduct from it
              WHEN c->>'stock_quantity' IS NOT NULL
              THEN jsonb_set(
                jsonb_set(c, '{stock_quantity}', to_jsonb(GREATEST(COALESCE((c->>'stock_quantity')::int, 0) - v_item.quantity, 0))),
                '{in_stock}',
                CASE WHEN COALESCE((c->>'stock_quantity')::int, 0) - v_item.quantity > 0 THEN 'true'::jsonb ELSE 'false'::jsonb END
              )
              ELSE c
            END
          ELSE c
        END
      ) INTO v_updated_colors
      FROM jsonb_array_elements(
        (SELECT colors FROM products WHERE id = v_item.product_id)
      ) AS c;

      IF v_updated_colors IS NOT NULL THEN
        UPDATE products SET colors = v_updated_colors WHERE id = v_item.product_id;
      END IF;
    END IF;

    -- Also deduct product_options stock_quantity if it's set
    IF v_item.product_option_id IS NOT NULL THEN
      UPDATE product_options 
      SET stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - v_item.quantity, 0),
          in_stock = CASE WHEN COALESCE(stock_quantity, 0) - v_item.quantity > 0 THEN true ELSE false END
      WHERE id = v_item.product_option_id
        AND stock_quantity IS NOT NULL;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
