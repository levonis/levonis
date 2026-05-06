-- Add valid_from to loyalty_card_codes for batch start date scheduling
ALTER TABLE public.loyalty_card_codes
  ADD COLUMN IF NOT EXISTS valid_from timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_loyalty_card_codes_valid_from
  ON public.loyalty_card_codes(valid_from);

-- Update create_loyalty_code_batch to accept p_valid_from (start date)
CREATE OR REPLACE FUNCTION public.create_loyalty_code_batch(
  p_card_id uuid,
  p_quantity integer,
  p_duration_days integer,
  p_code_expires_at timestamp with time zone,
  p_batch_label text DEFAULT NULL::text,
  p_requires_active_warranty boolean DEFAULT true,
  p_valid_from timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_batch uuid := gen_random_uuid();
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text; i int; j int; attempt int; inserted int := 0;
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_quantity < 1 OR p_quantity > 1000 THEN RAISE EXCEPTION 'invalid_quantity'; END IF;
  IF p_duration_days < 1 THEN RAISE EXCEPTION 'invalid_duration'; END IF;
  IF p_valid_from IS NOT NULL AND p_valid_from >= p_code_expires_at THEN
    RAISE EXCEPTION 'invalid_date_range';
  END IF;
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
          (card_id, code, batch_id, batch_label, duration_days, code_expires_at, valid_from, requires_active_warranty, status, created_by)
        VALUES (p_card_id, v_code, v_batch, p_batch_label, p_duration_days, p_code_expires_at, p_valid_from, p_requires_active_warranty, 'active', v_uid);
        inserted := inserted + 1; EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF attempt > 10 THEN RAISE EXCEPTION 'code_generation_failed'; END IF;
      END;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('batch_id', v_batch, 'count', inserted);
END; $function$;

-- Update redeem to enforce valid_from (start date not yet reached)
CREATE OR REPLACE FUNCTION public.redeem_loyalty_card_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  IF v_code.valid_from IS NOT NULL AND v_code.valid_from > now() THEN
    RAISE EXCEPTION 'code_not_yet_active';
  END IF;
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
END; $function$;