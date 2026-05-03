-- 1) Prevent users from deleting random-filament cart items
CREATE OR REPLACE FUNCTION public.protect_random_filament_cart_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.random_filament_orders WHERE cart_item_id = OLD.id AND order_id IS NULL)
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'RANDOM_FILAMENT_LOCKED'
      USING HINT = 'لا يمكن إلغاء طلب الفلمنت العشوائي. أي محاولة قد تؤدي للحظر.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_rf_cart_delete ON public.cart_items;
CREATE TRIGGER trg_protect_rf_cart_delete
  BEFORE DELETE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.protect_random_filament_cart_delete();

-- 2) Admin function: ban user when a placed RF order is not received
CREATE OR REPLACE FUNCTION public.ban_user_for_unreceived_random_filament(
  p_order_id uuid,
  p_reason text DEFAULT 'عدم استلام طلب فلمنت عشوائي'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT user_id INTO v_owner FROM public.orders WHERE id = p_order_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.random_filament_orders WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'NOT_RANDOM_ORDER';
  END IF;

  INSERT INTO public.random_filament_bans (user_id, reason)
  VALUES (v_owner, COALESCE(p_reason, 'عدم استلام طلب فلمنت عشوائي'))
  ON CONFLICT (user_id) DO UPDATE SET reason = EXCLUDED.reason, banned_at = now();

  RETURN jsonb_build_object('banned', true, 'user_id', v_owner);
END;
$$;

REVOKE ALL ON FUNCTION public.ban_user_for_unreceived_random_filament(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ban_user_for_unreceived_random_filament(uuid, text) TO authenticated;