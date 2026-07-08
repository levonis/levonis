
CREATE OR REPLACE FUNCTION public.redeem_points_in_cart(p_order_id uuid, p_points integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_available numeric;
  v_owner uuid;
  v_subtotal numeric;
  v_already numeric;
  v_max_redeemable numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_points IS NULL OR p_points <= 0 THEN RETURN false; END IF;

  SELECT user_id, COALESCE(subtotal, 0), COALESCE(points_discount_amount, 0)
    INTO v_owner, v_subtotal, v_already
  FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF v_owner IS NULL OR v_owner <> v_user THEN
    RAISE EXCEPTION 'order not found or not owned by caller';
  END IF;

  -- Cap: points cannot exceed order value (subtotal + already-redeemed points = pre-redemption subtotal)
  v_max_redeemable := v_subtotal + v_already;
  IF p_points > v_max_redeemable THEN
    RAISE EXCEPTION 'points exceed cart total (max %, requested %)', v_max_redeemable, p_points;
  END IF;

  SELECT available_points INTO v_available FROM public.user_points WHERE user_id = v_user FOR UPDATE;
  IF COALESCE(v_available, 0) < p_points THEN
    RAISE EXCEPTION 'insufficient points (available %, requested %)', COALESCE(v_available,0), p_points;
  END IF;

  UPDATE public.user_points
     SET available_points = available_points - p_points,
         redeemed_points  = COALESCE(redeemed_points, 0) + p_points,
         updated_at = now()
   WHERE user_id = v_user;

  INSERT INTO public.points_transactions (user_id, points, type, source, related_id, description)
  VALUES (v_user, -p_points, 'spend', 'cart_redemption', p_order_id, 'خصم نقاط في السلة');

  UPDATE public.orders
     SET points_redeemed = COALESCE(points_redeemed, 0) + p_points,
         points_discount_amount = COALESCE(points_discount_amount, 0) + p_points
   WHERE id = p_order_id;

  RETURN true;
END;
$function$;
