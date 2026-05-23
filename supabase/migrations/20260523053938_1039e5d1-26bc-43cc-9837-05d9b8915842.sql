
CREATE OR REPLACE FUNCTION public.admin_adjust_product_counters(
  p_product_id uuid,
  p_order_type text DEFAULT 'direct',
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
  v_sold_delta integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  IF p_product_id IS NULL OR p_quantity_change = 0 THEN
    RETURN;
  END IF;

  -- p_quantity_change convention follows admin_adjust_order_inventory:
  --   negative = sale (deduct stock), positive = return (restore stock)
  -- sold_count moves opposite to that.
  v_sold_delta := -p_quantity_change;

  IF lower(coalesce(p_order_type, 'direct')) = 'preorder' THEN
    -- Pre-order: only touch pre_order_stock (allow going negative -> clamp at 0)
    UPDATE products
    SET pre_order_stock = GREATEST(0, COALESCE(pre_order_stock, 0) + p_quantity_change)
    WHERE id = p_product_id;
  ELSE
    -- Direct sale: reuse existing logic for direct_stock + color option_stocks
    PERFORM public.admin_adjust_order_inventory(
      p_product_id,
      p_option_name,
      p_selected_color,
      p_quantity_change
    );
  END IF;

  -- Always adjust sold_count
  UPDATE products
  SET sold_count = GREATEST(0, COALESCE(sold_count, 0) + v_sold_delta)
  WHERE id = p_product_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_adjust_product_counters(uuid, text, text, text, integer) TO authenticated;
