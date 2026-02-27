
-- Add stock_deducted flag to orders to prevent double deduction
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_deducted boolean DEFAULT false;

-- Update existing direct orders as already deducted
UPDATE public.orders SET stock_deducted = true WHERE order_type = 'direct';

-- Create a trigger function that auto-deducts stock when order status is set
CREATE OR REPLACE FUNCTION public.auto_deduct_stock_on_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for direct sale orders that haven't been deducted yet
  IF NEW.order_type = 'direct' AND NEW.stock_deducted IS NOT TRUE THEN
    -- Check if order_items exist
    IF EXISTS (SELECT 1 FROM order_items WHERE order_id = NEW.id) THEN
      PERFORM public.deduct_order_stock(NEW.id);
      NEW.stock_deducted := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Create trigger on UPDATE (when items are already inserted)
DROP TRIGGER IF EXISTS trg_auto_deduct_stock ON public.orders;
CREATE TRIGGER trg_auto_deduct_stock
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.stock_deducted IS NOT TRUE AND NEW.order_type = 'direct')
  EXECUTE FUNCTION public.auto_deduct_stock_on_order();

-- Also update deduct_order_stock to set the flag
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
  v_updated_colors JSONB;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN RETURN; END IF;
  IF v_order.order_type != 'direct' THEN RETURN; END IF;
  -- Prevent double deduction
  IF v_order.stock_deducted = true THEN RETURN; END IF;
  
  FOR v_item IN 
    SELECT oi.product_id, oi.product_option_id, oi.quantity, oi.selected_color
    FROM order_items oi 
    WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
  LOOP
    v_option_name := NULL;
    IF v_item.product_option_id IS NOT NULL THEN
      SELECT name_ar INTO v_option_name FROM product_options WHERE id = v_item.product_option_id;
    END IF;

    IF v_item.selected_color IS NOT NULL AND v_item.product_id IS NOT NULL THEN
      SELECT jsonb_agg(
        CASE 
          WHEN (c->>'name_ar' = v_item.selected_color OR c->>'name' = v_item.selected_color)
          THEN
            CASE
              WHEN v_option_name IS NOT NULL AND c->'option_stocks' IS NOT NULL AND c->'option_stocks'->v_option_name IS NOT NULL
              THEN jsonb_set(
                c,
                ARRAY['option_stocks', v_option_name],
                to_jsonb(GREATEST(COALESCE((c->'option_stocks'->>v_option_name)::int, 0) - v_item.quantity, 0))
              )
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

    IF v_item.product_option_id IS NOT NULL THEN
      UPDATE product_options 
      SET stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - v_item.quantity, 0),
          in_stock = CASE WHEN COALESCE(stock_quantity, 0) - v_item.quantity > 0 THEN true ELSE false END
      WHERE id = v_item.product_option_id
        AND stock_quantity IS NOT NULL;
    END IF;
  END LOOP;

  -- Mark as deducted
  UPDATE orders SET stock_deducted = true WHERE id = p_order_id;
END;
$function$;
