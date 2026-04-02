
CREATE OR REPLACE FUNCTION public.deduct_prize_stock(p_product_id uuid, p_color text DEFAULT NULL, p_option_name text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product products%ROWTYPE;
  v_colors jsonb;
  v_color jsonb;
  v_option_stocks jsonb;
  v_current_stock integer;
  v_color_index integer;
  v_found boolean := false;
BEGIN
  IF p_product_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  
  IF v_product.id IS NULL THEN
    RETURN false;
  END IF;

  -- Try direct_stock first
  IF v_product.direct_stock IS NOT NULL AND v_product.direct_stock > 0 THEN
    UPDATE products 
    SET direct_stock = direct_stock - 1, updated_at = now()
    WHERE id = p_product_id AND direct_stock > 0;
    RETURN true;
  END IF;

  -- Try pre_order_stock as fallback
  IF v_product.pre_order_stock IS NOT NULL AND v_product.pre_order_stock > 0 THEN
    UPDATE products 
    SET pre_order_stock = pre_order_stock - 1, updated_at = now()
    WHERE id = p_product_id AND pre_order_stock > 0;
    RETURN true;
  END IF;

  -- Try variant-level stock from colors JSONB
  v_colors := v_product.colors;
  IF v_colors IS NOT NULL AND jsonb_typeof(v_colors) = 'array' THEN
    FOR v_color_index IN 0..jsonb_array_length(v_colors) - 1 LOOP
      v_color := v_colors -> v_color_index;
      v_option_stocks := v_color -> 'option_stocks';
      
      IF v_option_stocks IS NULL OR jsonb_typeof(v_option_stocks) != 'object' THEN
        CONTINUE;
      END IF;

      -- If specific color requested, match it
      IF p_color IS NOT NULL AND v_color ->> 'name' != p_color THEN
        CONTINUE;
      END IF;

      -- Check if this color has stock for any option (or specific option)
      DECLARE
        v_opt_key text;
        v_opt_val integer;
      BEGIN
        FOR v_opt_key, v_opt_val IN SELECT key, (value#>>'{}')::integer FROM jsonb_each(v_option_stocks) LOOP
          -- If specific option requested, match it
          IF p_option_name IS NOT NULL AND v_opt_key != p_option_name THEN
            CONTINUE;
          END IF;
          
          IF v_opt_val > 0 THEN
            -- Deduct stock from this variant
            v_colors := jsonb_set(
              v_colors,
              ARRAY[v_color_index::text, 'option_stocks', v_opt_key],
              to_jsonb(v_opt_val - 1)
            );
            
            UPDATE products 
            SET colors = v_colors, updated_at = now()
            WHERE id = p_product_id;
            
            RETURN true;
          END IF;
        END LOOP;
      END;
    END LOOP;
  END IF;

  RETURN false;
END;
$$;
