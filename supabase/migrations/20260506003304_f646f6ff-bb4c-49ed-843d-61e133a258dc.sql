
DROP FUNCTION IF EXISTS public.expire_loyalty_card_codes() CASCADE;
DROP FUNCTION IF EXISTS public.redeem_loyalty_card_code(text) CASCADE;
DROP FUNCTION IF EXISTS public.create_loyalty_code_batch(uuid,int,int,timestamptz,text,boolean) CASCADE;
DROP FUNCTION IF EXISTS public.check_user_printer_warranty() CASCADE;

CREATE OR REPLACE FUNCTION public.check_user_printer_warranty()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_has_printer boolean; v_max_end timestamptz;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('status','auth_required'); END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_printers WHERE user_id = v_uid) INTO v_has_printer;
  IF NOT v_has_printer THEN RETURN jsonb_build_object('status','no_printer_registered'); END IF;
  SELECT MAX(ps.end_date) INTO v_max_end FROM public.printer_subscriptions ps
    JOIN public.user_printers up ON up.id = ps.user_printer_id
   WHERE up.user_id = v_uid AND ps.status = 'active';
  IF v_max_end IS NULL THEN RETURN jsonb_build_object('status','no_active_warranty'); END IF;
  IF v_max_end < now() THEN RETURN jsonb_build_object('status','warranty_expired','expiry_date',v_max_end); END IF;
  RETURN jsonb_build_object('status','active','expiry_date',v_max_end);
END; $$;

CREATE OR REPLACE FUNCTION public.expire_loyalty_card_codes()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.loyalty_card_codes SET status='expired', updated_at=now()
   WHERE status='active' AND code_expires_at < now();
$$;

CREATE OR REPLACE FUNCTION public.create_loyalty_code_batch(
  p_card_id uuid, p_quantity int, p_duration_days int,
  p_code_expires_at timestamptz, p_batch_label text DEFAULT NULL,
  p_requires_active_warranty boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_batch uuid := gen_random_uuid();
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text; i int; j int; attempt int; inserted int := 0;
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_quantity < 1 OR p_quantity > 1000 THEN RAISE EXCEPTION 'invalid_quantity'; END IF;
  IF p_duration_days < 1 THEN RAISE EXCEPTION 'invalid_duration'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.membership_cards WHERE id = p_card_id) THEN RAISE EXCEPTION 'card_not_found'; END IF;
  FOR i IN 1..p_quantity LOOP
    attempt := 0;
    LOOP
      attempt := attempt + 1;
      v_code := '';
      FOR j IN 1..12 LOOP
        v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
      END LOOP;
      BEGIN
        INSERT INTO public.loyalty_card_codes
          (card_id, code, batch_id, batch_label, duration_days, code_expires_at, requires_active_warranty, status, created_by)
        VALUES (p_card_id, v_code, v_batch, p_batch_label, p_duration_days, p_code_expires_at, p_requires_active_warranty, 'active', v_uid);
        inserted := inserted + 1; EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF attempt > 10 THEN RAISE EXCEPTION 'code_generation_failed'; END IF;
      END;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('batch_id', v_batch, 'count', inserted);
END; $$;

CREATE OR REPLACE FUNCTION public.redeem_loyalty_card_code(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
  v_code public.loyalty_card_codes%ROWTYPE;
  v_card public.membership_cards%ROWTYPE;
  v_warranty jsonb; v_user_card_id uuid; v_user_printer_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO v_code FROM public.loyalty_card_codes WHERE code = upper(trim(p_code)) FOR UPDATE;
  IF v_code.id IS NULL THEN RAISE EXCEPTION 'code_not_found'; END IF;
  IF v_code.status = 'redeemed' THEN RAISE EXCEPTION 'code_already_used'; END IF;
  IF v_code.status = 'revoked' THEN RAISE EXCEPTION 'code_not_found'; END IF;
  IF v_code.status = 'expired' OR v_code.code_expires_at < now() THEN
    UPDATE public.loyalty_card_codes SET status='expired', updated_at=now() WHERE id = v_code.id;
    RAISE EXCEPTION 'code_expired';
  END IF;
  SELECT * INTO v_card FROM public.membership_cards WHERE id = v_code.card_id;
  IF v_card.id IS NULL THEN RAISE EXCEPTION 'card_not_found'; END IF;
  IF v_code.requires_active_warranty THEN
    v_warranty := public.check_user_printer_warranty();
    IF (v_warranty->>'status') <> 'active' THEN RAISE EXCEPTION '%', (v_warranty->>'status'); END IF;
    SELECT up.id INTO v_user_printer_id FROM public.printer_subscriptions ps
      JOIN public.user_printers up ON up.id = ps.user_printer_id
     WHERE up.user_id = v_uid AND ps.status = 'active'
     ORDER BY ps.end_date DESC LIMIT 1;
  END IF;
  UPDATE public.user_cards SET is_active=false, updated_at=now() WHERE user_id=v_uid AND is_active=true;
  INSERT INTO public.user_cards (user_id, card_id, is_active, expires_at, payment_method)
  VALUES (v_uid, v_code.card_id, true, now() + make_interval(days => v_code.duration_days), 'code_redemption')
  RETURNING id INTO v_user_card_id;
  UPDATE public.loyalty_card_codes
     SET status='redeemed', redeemed_by_user_id=v_uid, redeemed_user_printer_id=v_user_printer_id,
         redeemed_at=now(), updated_at=now()
   WHERE id = v_code.id;
  RETURN jsonb_build_object('success', true, 'user_card_id', v_user_card_id, 'card_id', v_code.card_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.check_user_printer_warranty() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_loyalty_card_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_loyalty_code_batch(uuid,int,int,timestamptz,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_card_code(text) TO authenticated;
