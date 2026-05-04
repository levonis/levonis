CREATE OR REPLACE FUNCTION public.protect_random_filament_cart_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_user boolean;
  conflict_exists boolean;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin') INTO is_admin_user;
  IF is_admin_user THEN
    RETURN NEW;
  END IF;

  -- Skip self (in case of RF item being inserted by the RPC); RF inserts come from SECURITY DEFINER RPC where auth.uid() is still the user, so we only block when there is an EXISTING RF item that matches.
  SELECT EXISTS (
    SELECT 1
    FROM public.cart_items ci
    JOIN public.random_filament_orders rfo ON rfo.cart_item_id = ci.id
    WHERE ci.user_id = NEW.user_id
      AND ci.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND ci.product_id IS NOT DISTINCT FROM NEW.product_id
      AND ci.product_option_id IS NOT DISTINCT FROM NEW.product_option_id
      AND ci.selected_color IS NOT DISTINCT FROM NEW.selected_color
  ) INTO conflict_exists;

  IF conflict_exists THEN
    RAISE EXCEPTION 'RANDOM_FILAMENT_DUPLICATE' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_rf_cart_insert ON public.cart_items;
CREATE TRIGGER trg_protect_rf_cart_insert
  BEFORE INSERT ON public.cart_items
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_random_filament_cart_insert();