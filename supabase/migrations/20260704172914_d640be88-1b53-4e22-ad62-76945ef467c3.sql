
CREATE OR REPLACE FUNCTION public.redeem_points_for_tickets(p_points integer, p_tickets integer, p_description text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF p_points <= 0 OR p_tickets <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  -- Deduct points (raises if insufficient)
  PERFORM public.deduct_user_points(v_user, p_points, 'redemption', COALESCE(p_description, 'Redeem points for tickets'));

  -- Grant tickets directly (we are SECURITY DEFINER so we bypass add_user_tickets)
  INSERT INTO public.user_tickets (user_id, ticket_count)
  VALUES (v_user, p_tickets)
  ON CONFLICT (user_id) DO UPDATE
    SET ticket_count = user_tickets.ticket_count + p_tickets,
        updated_at = NOW();

  INSERT INTO public.daily_redemption_log (user_id, redemption_type, points_redeemed)
  VALUES (v_user, 'tickets', p_points);

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_points_for_tickets(integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_points_for_tickets(integer, integer, text) TO authenticated;
