
CREATE OR REPLACE FUNCTION public.admin_regen_levo_card_secrets(p_card_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pin text;
  v_qr text;
  v_nfc text;
  v_card_number text;
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT card_number, qr_token, nfc_token
    INTO v_card_number, v_qr, v_nfc
  FROM public.levo_physical_cards
  WHERE id = p_card_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');
  IF v_qr IS NULL THEN v_qr := replace(gen_random_uuid()::text, '-', ''); END IF;
  IF v_nfc IS NULL THEN v_nfc := replace(gen_random_uuid()::text, '-', ''); END IF;

  UPDATE public.levo_physical_cards
     SET pin_plaintext = v_pin,
         pin_hash = extensions.crypt(v_pin, extensions.gen_salt('bf')),
         qr_token = v_qr,
         nfc_token = v_nfc,
         updated_at = now()
   WHERE id = p_card_id;

  RETURN jsonb_build_object(
    'success', true,
    'card_number', v_card_number,
    'pin', v_pin,
    'qr_token', v_qr,
    'nfc_token', v_nfc
  );
END;
$$;
