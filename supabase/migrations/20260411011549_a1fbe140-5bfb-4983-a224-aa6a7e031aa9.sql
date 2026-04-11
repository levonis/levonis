
-- Function to atomically adjust inventory for a product
CREATE OR REPLACE FUNCTION public.admin_adjust_order_inventory(
  p_product_id UUID,
  p_option_id UUID DEFAULT NULL,
  p_selected_color TEXT DEFAULT NULL,
  p_quantity_change INT DEFAULT 0  -- positive = restore stock, negative = deduct stock
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  -- Update product-level stock and sold_count
  UPDATE products
  SET 
    stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) + p_quantity_change),
    sold_count = GREATEST(0, COALESCE(sold_count, 0) - p_quantity_change),
    direct_stock = GREATEST(0, COALESCE(direct_stock, 0) + p_quantity_change)
  WHERE id = p_product_id;

  -- If there's an option (color variant), update option-level stock in colors JSONB
  IF p_selected_color IS NOT NULL THEN
    UPDATE products
    SET colors = (
      SELECT jsonb_agg(
        CASE
          WHEN (color_obj->>'name') = p_selected_color THEN
            jsonb_set(
              color_obj,
              '{option_stocks}',
              COALESCE(
                (SELECT jsonb_agg(
                  CASE
                    WHEN p_option_id IS NOT NULL AND (opt->>'option_id') = p_option_id::text THEN
                      jsonb_set(opt, '{stock}', to_jsonb(GREATEST(0, COALESCE((opt->>'stock')::int, 0) + p_quantity_change)))
                    WHEN p_option_id IS NULL AND (opt->>'option_id') IS NULL THEN
                      jsonb_set(opt, '{stock}', to_jsonb(GREATEST(0, COALESCE((opt->>'stock')::int, 0) + p_quantity_change)))
                    ELSE opt
                  END
                ) FROM jsonb_array_elements(COALESCE(color_obj->'option_stocks', '[]'::jsonb)) opt),
                '[]'::jsonb
              )
            )
          ELSE color_obj
        END
      )
      FROM jsonb_array_elements(COALESCE(colors, '[]'::jsonb)) color_obj
    )
    WHERE id = p_product_id;
  END IF;
END;
$$;
