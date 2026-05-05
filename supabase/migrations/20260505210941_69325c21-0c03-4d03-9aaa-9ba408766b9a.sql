CREATE OR REPLACE FUNCTION public.redeem_loyalty_card_code(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_code public.loyalty_card_codes%ROWTYPE;
  v_printer_id uuid;
  v_user_card_id uuid;
  v_expires_at timestamptz;
  v_has_any_printer boolean;
  v_has_expired_printer boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT * INTO v_code
  FROM public.loyalty_card_codes
  WHERE code = upper(trim(p_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'code_not_found';
  END IF;

  IF v_code.status <> 'active' THEN
    RAISE EXCEPTION 'code_already_used';
  END IF;

  IF v_code.code_expires_at <= now() THEN
    UPDATE public.loyalty_card_codes SET status='expired' WHERE id = v_code.id;
    RAISE EXCEPTION 'code_expired';
  END IF;

  IF v_code.requires_active_warranty THEN
    SELECT id INTO v_printer_id
    FROM public.store_printers
    WHERE buyer_user_id = v_user
      AND COALESCE(status, 'active') = 'active'
      AND expiry_date IS NOT NULL
      AND expiry_date > now()
    ORDER BY expiry_date DESC
    LIMIT 1;

    IF v_printer_id IS NULL THEN
      SELECT EXISTS(SELECT 1 FROM public.store_printers WHERE buyer_user_id = v_user) INTO v_has_any_printer;
      SELECT EXISTS(
        SELECT 1 FROM public.store_printers
        WHERE buyer_user_id = v_user
          AND expiry_date IS NOT NULL
          AND expiry_date <= now()
      ) INTO v_has_expired_printer;

      IF NOT v_has_any_printer THEN
        RAISE EXCEPTION 'no_printer_registered';
      ELSIF v_has_expired_printer THEN
        RAISE EXCEPTION 'warranty_expired';
      ELSE
        RAISE EXCEPTION 'no_active_warranty';
      END IF;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_cards
    WHERE user_id = v_user
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RAISE EXCEPTION 'already_has_active_card';
  END IF;

  v_expires_at := now() + (v_code.duration_days || ' days')::interval;

  INSERT INTO public.user_cards(
    user_id, card_id, purchased_at, expires_at,
    points_spent, is_active, payment_method, wallet_amount_paid
  )
  VALUES (
    v_user, v_code.card_id, now(), v_expires_at,
    0, true, 'code', 0
  )
  RETURNING id INTO v_user_card_id;

  UPDATE public.loyalty_card_codes
  SET status='redeemed',
      redeemed_by_user_id = v_user,
      redeemed_user_printer_id = v_printer_id,
      redeemed_at = now()
  WHERE id = v_code.id;

  RETURN jsonb_build_object(
    'user_card_id', v_user_card_id,
    'card_id', v_code.card_id,
    'expires_at', v_expires_at
  );
END;
$function$;