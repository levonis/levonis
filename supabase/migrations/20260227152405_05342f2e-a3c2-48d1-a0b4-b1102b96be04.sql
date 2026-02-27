
-- Phase 1: Add direct_sale_price to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS direct_sale_price numeric;

-- Phase 2: Add sale_type to cart_items
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS sale_type text DEFAULT 'preorder';

-- Phase 4: Add order_type to orders  
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'preorder';

-- Phase 7: Create stock reduction function for direct sales
CREATE OR REPLACE FUNCTION public.reduce_stock_on_direct_order()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  product_colors jsonb;
  color_idx int;
  updated_colors jsonb;
  color_entry jsonb;
  option_stocks jsonb;
  current_stock int;
BEGIN
  -- Only trigger for direct sale orders
  IF NEW.order_type != 'direct' THEN
    RETURN NEW;
  END IF;
  
  -- Only trigger when status changes to confirmed/processing
  IF NEW.status NOT IN ('confirmed', 'processing') THEN
    RETURN NEW;
  END IF;
  
  -- If updating, only trigger on status change
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Loop through order items
  FOR item IN 
    SELECT oi.product_id, oi.quantity, oi.selected_color, oi.selected_option
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
  LOOP
    IF item.product_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Get product colors
    SELECT colors INTO product_colors
    FROM public.products
    WHERE id = item.product_id;

    IF product_colors IS NULL OR jsonb_array_length(product_colors) = 0 THEN
      CONTINUE;
    END IF;

    updated_colors := product_colors;

    -- Find matching color and reduce stock
    FOR color_idx IN 0..jsonb_array_length(product_colors) - 1 LOOP
      color_entry := product_colors->color_idx;
      
      IF color_entry->>'name_ar' = item.selected_color OR color_entry->>'name' = item.selected_color THEN
        IF item.selected_option IS NOT NULL AND color_entry->'option_stocks' IS NOT NULL THEN
          -- Reduce option-specific stock
          option_stocks := color_entry->'option_stocks';
          current_stock := COALESCE((option_stocks->>item.selected_option)::int, 0);
          option_stocks := jsonb_set(option_stocks, ARRAY[item.selected_option], to_jsonb(GREATEST(0, current_stock - item.quantity)));
          color_entry := jsonb_set(color_entry, '{option_stocks}', option_stocks);
        END IF;
        
        -- Reduce general stock_quantity
        current_stock := COALESCE((color_entry->>'stock_quantity')::int, 0);
        color_entry := jsonb_set(color_entry, '{stock_quantity}', to_jsonb(GREATEST(0, current_stock - item.quantity)));
        
        updated_colors := jsonb_set(updated_colors, ARRAY[color_idx::text], color_entry);
        EXIT;
      END IF;
    END LOOP;

    -- Update product colors
    UPDATE public.products
    SET colors = updated_colors
    WHERE id = item.product_id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for stock reduction
DROP TRIGGER IF EXISTS trigger_reduce_stock_on_direct_order ON public.orders;
CREATE TRIGGER trigger_reduce_stock_on_direct_order
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.reduce_stock_on_direct_order();
