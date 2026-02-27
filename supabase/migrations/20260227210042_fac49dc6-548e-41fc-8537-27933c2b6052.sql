-- Prevent duplicate/legacy stock deductions and enforce safe fallback behavior

-- 1) Remove legacy trigger that can double-deduct stock on status transitions
DROP TRIGGER IF EXISTS trigger_reduce_stock_on_direct_order ON public.orders;

-- 2) Keep fallback trigger but make function status-aware so cancel/return updates never deduct stock
CREATE OR REPLACE FUNCTION public.auto_deduct_stock_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deducted boolean;
BEGIN
  -- Deduct only for active direct-sale lifecycle states
  IF NEW.order_type = 'direct'
     AND NEW.stock_deducted IS NOT TRUE
     AND NEW.status IN ('confirmed', 'processing')
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
$function$;