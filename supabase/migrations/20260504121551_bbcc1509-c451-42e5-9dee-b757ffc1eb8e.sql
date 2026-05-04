-- Server-side guard: prevent any quantity/field changes on Random Filament cart items
CREATE OR REPLACE FUNCTION public.protect_random_filament_cart_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_rf boolean;
  is_admin_user boolean;
BEGIN
  -- Allow admins to bypass
  SELECT public.has_role(auth.uid(), 'admin') INTO is_admin_user;
  IF is_admin_user THEN
    RETURN NEW;
  END IF;

  -- Check if this cart item is linked to a random filament order
  SELECT EXISTS (
    SELECT 1 FROM public.random_filament_orders
    WHERE cart_item_id = OLD.id
  ) INTO is_rf;

  IF NOT is_rf THEN
    RETURN NEW;
  END IF;

  -- Block changes to quantity or core identity fields on RF cart items
  IF NEW.quantity IS DISTINCT FROM OLD.quantity
     OR NEW.product_id IS DISTINCT FROM OLD.product_id
     OR NEW.product_option_id IS DISTINCT FROM OLD.product_option_id
     OR NEW.selected_color IS DISTINCT FROM OLD.selected_color
     OR NEW.sale_type IS DISTINCT FROM OLD.sale_type
  THEN
    RAISE EXCEPTION 'RANDOM_FILAMENT_LOCKED' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_rf_cart_update ON public.cart_items;
CREATE TRIGGER trg_protect_rf_cart_update
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_random_filament_cart_update();