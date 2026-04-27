-- Helper: grant a coupon row in user_coupons when a level prize coupon is granted
CREATE OR REPLACE FUNCTION public.grant_level_prize_coupon(p_user_id uuid, p_prize_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prize RECORD;
  v_code TEXT;
  v_dvalue NUMERIC;
  v_dtype TEXT;
  v_exists BOOLEAN;
BEGIN
  SELECT prize_type, coupon_code, prize_value
    INTO v_prize
  FROM public.level_prizes
  WHERE id = p_prize_id;

  IF v_prize IS NULL OR v_prize.prize_type <> 'coupon' OR v_prize.coupon_code IS NULL THEN
    RETURN;
  END IF;

  -- Try to read details from the global coupons table
  SELECT discount_type, discount_value
    INTO v_dtype, v_dvalue
  FROM public.coupons
  WHERE code = v_prize.coupon_code AND active = true
  LIMIT 1;

  IF v_dvalue IS NULL THEN
    v_dvalue := COALESCE(v_prize.prize_value, 0);
    v_dtype := COALESCE(v_dtype, 'fixed');
  END IF;

  -- Generate a unique per-user code derived from the prize code
  v_code := v_prize.coupon_code || '-' || substr(replace(p_user_id::text, '-', ''), 1, 6);

  SELECT EXISTS (SELECT 1 FROM public.user_coupons WHERE coupon_code = v_code) INTO v_exists;
  IF v_exists THEN
    RETURN;
  END IF;

  INSERT INTO public.user_coupons (user_id, coupon_code, discount_value, discount_type, source)
  VALUES (p_user_id, v_code, v_dvalue, COALESCE(v_dtype, 'fixed'), 'level_prize');
END;
$$;

-- Update auto-grant in level-up flow
CREATE OR REPLACE FUNCTION public.add_user_level_xp(p_user_id uuid, p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_xp NUMERIC := 0;
  v_current_level INTEGER := 1;
  v_threshold NUMERIC;
  v_levels_gained INTEGER := 0;
  v_prize RECORD;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount'); END IF;

  INSERT INTO public.user_points (user_id, total_points, available_points)
  VALUES (p_user_id, 0, 0) ON CONFLICT (user_id) DO NOTHING;

  SELECT current_level_xp, GREATEST(current_level_number, 1) INTO v_current_xp, v_current_level
  FROM public.user_points WHERE user_id = p_user_id FOR UPDATE;

  v_current_xp := COALESCE(v_current_xp, 0) + p_amount;

  LOOP
    SELECT xp_required INTO v_threshold FROM public.loyalty_levels WHERE level_number = v_current_level;
    EXIT WHEN v_threshold IS NULL OR v_current_xp < v_threshold OR v_current_level >= 100;
    v_current_xp := v_current_xp - v_threshold;
    v_current_level := v_current_level + 1;
    v_levels_gained := v_levels_gained + 1;

    IF v_current_level % 5 = 0 THEN
      FOR v_prize IN SELECT id, prize_type, auto_grant FROM public.level_prizes WHERE level_number = v_current_level AND is_active = true LOOP
        INSERT INTO public.user_level_prize_claims (user_id, level_number, prize_id, status, granted_at)
        VALUES (p_user_id, v_current_level, v_prize.id,
          CASE WHEN v_prize.auto_grant THEN 'granted' ELSE 'pending' END,
          CASE WHEN v_prize.auto_grant THEN now() ELSE NULL END)
        ON CONFLICT (user_id, prize_id) DO NOTHING;

        -- Auto-link coupon to user_coupons when granted
        IF v_prize.auto_grant AND v_prize.prize_type = 'coupon' THEN
          PERFORM public.grant_level_prize_coupon(p_user_id, v_prize.id);
        END IF;
      END LOOP;
      INSERT INTO public.notifications (user_id, title, message, type, related_id)
      VALUES (p_user_id, 'مبروك! ترقية مستوى', 'وصلت إلى المستوى ' || v_current_level || ' — تحقق من جوائزك!', 'success', p_user_id);
    END IF;
  END LOOP;

  UPDATE public.user_points
  SET current_level_xp = v_current_xp, current_level_number = v_current_level,
      total_xp = COALESCE(total_xp, 0) + p_amount, level = 'level_' || v_current_level, updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'level', v_current_level, 'current_xp', v_current_xp, 'levels_gained', v_levels_gained);
END; $function$;

-- Update admin manual grant
CREATE OR REPLACE FUNCTION public.admin_update_level_prize_claim(p_claim_id uuid, p_new_status text, p_notes text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_user_id UUID;
  v_prize_id UUID;
  v_prize_type TEXT;
  v_prev_status TEXT;
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_new_status NOT IN ('pending', 'requested', 'granted', 'shipped', 'delivered', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status');
  END IF;

  SELECT user_id, prize_id, status INTO v_user_id, v_prize_id, v_prev_status
  FROM public.user_level_prize_claims WHERE id = p_claim_id;

  UPDATE public.user_level_prize_claims
  SET status = p_new_status,
      notes = COALESCE(p_notes, notes),
      shipped_at = CASE WHEN p_new_status = 'shipped' THEN now() ELSE shipped_at END,
      delivered_at = CASE WHEN p_new_status = 'delivered' THEN now() ELSE delivered_at END,
      granted_at = CASE WHEN p_new_status = 'granted' AND granted_at IS NULL THEN now() ELSE granted_at END,
      updated_at = now()
  WHERE id = p_claim_id;

  -- When admin marks as granted, auto-link coupon prize to user_coupons
  IF p_new_status = 'granted' AND v_prev_status <> 'granted' THEN
    SELECT prize_type INTO v_prize_type FROM public.level_prizes WHERE id = v_prize_id;
    IF v_prize_type = 'coupon' THEN
      PERFORM public.grant_level_prize_coupon(v_user_id, v_prize_id);
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;