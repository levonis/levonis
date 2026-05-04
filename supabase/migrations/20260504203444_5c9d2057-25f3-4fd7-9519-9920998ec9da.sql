-- Allow quantity changes & deletion on unrevealed random-filament cart items
CREATE OR REPLACE FUNCTION public.protect_random_filament_cart_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_revealed boolean;
  is_admin_user boolean;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin') INTO is_admin_user;
  IF is_admin_user THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.random_filament_orders
    WHERE cart_item_id = OLD.id AND revealed_at IS NOT NULL
  ) INTO is_revealed;

  IF NOT is_revealed THEN
    RETURN NEW;
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.protect_random_filament_cart_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.random_filament_orders
    WHERE cart_item_id = OLD.id AND revealed_at IS NOT NULL
  ) AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'RANDOM_FILAMENT_LOCKED'
      USING HINT = 'لا يمكن إلغاء طلب الفلمنت العشوائي بعد الكشف عن اللون.';
  END IF;
  RETURN OLD;
END;
$function$;