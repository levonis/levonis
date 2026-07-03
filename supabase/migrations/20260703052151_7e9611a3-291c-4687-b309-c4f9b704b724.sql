
ALTER TABLE public.levo_physical_cards
  ADD COLUMN IF NOT EXISTS pin_plaintext text;

REVOKE SELECT (pin_plaintext) ON public.levo_physical_cards FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_generate_levo_cards(p_count integer, p_batch_label text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_i integer;
  v_num text; v_pin text; v_qr text; v_nfc text;
  v_id uuid;
  v_cards jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('success', false, 'error','forbidden');
  END IF;
  IF coalesce(p_count,0) < 1 OR p_count > 5000 THEN
    RETURN jsonb_build_object('success', false, 'error','invalid_count');
  END IF;

  FOR v_i IN 1..p_count LOOP
    v_num := public.generate_levo_card_number();
    v_pin := public.generate_levo_pin();
    v_qr  := 'LVQR-' || public.generate_levo_token();
    v_nfc := 'LVNF-' || public.generate_levo_token();

    INSERT INTO public.levo_physical_cards(
      card_number, card_number_last4, batch_label, created_by,
      pin_hash, pin_plaintext, qr_token, nfc_token
    ) VALUES (
      v_num, right(v_num, 4), p_batch_label, auth.uid(),
      extensions.crypt(v_pin, extensions.gen_salt('bf', 8)),
      v_pin, v_qr, v_nfc
    ) RETURNING id INTO v_id;

    v_cards := v_cards || jsonb_build_object(
      'id', v_id, 'card_number', v_num, 'pin', v_pin,
      'qr_token', v_qr, 'nfc_token', v_nfc
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'count', p_count, 'cards', v_cards);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_generate_levo_cards(integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reveal_levo_batch(p_batch_label text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cards jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('success', false, 'error','forbidden');
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'card_number', card_number, 'pin', pin_plaintext,
    'qr_token', qr_token, 'nfc_token', nfc_token, 'status', status
  ) ORDER BY created_at), '[]'::jsonb)
  INTO v_cards
  FROM public.levo_physical_cards
  WHERE (p_batch_label IS NULL AND batch_label IS NULL)
     OR batch_label = p_batch_label;
  RETURN jsonb_build_object('success', true, 'cards', v_cards);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_reveal_levo_batch(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reveal_levo_card(p_card_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('success', false, 'error','forbidden');
  END IF;
  SELECT jsonb_build_object(
    'id', id, 'card_number', card_number, 'pin', pin_plaintext,
    'qr_token', qr_token, 'nfc_token', nfc_token, 'status', status
  ) INTO v
  FROM public.levo_physical_cards WHERE id = p_card_id;
  IF v IS NULL THEN RETURN jsonb_build_object('success', false, 'error','not_found'); END IF;
  RETURN jsonb_build_object('success', true, 'card', v);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_reveal_levo_card(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_levo_card_product(
  p_price numeric,
  p_name_ar text DEFAULT NULL,
  p_name_en text DEFAULT NULL,
  p_name_ku text DEFAULT NULL,
  p_description_ar text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := public.get_levo_card_product_id();
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('success', false, 'error','forbidden');
  END IF;
  IF p_price IS NULL OR p_price < 0 THEN
    RETURN jsonb_build_object('success', false, 'error','invalid_price');
  END IF;
  UPDATE public.products SET
    price = p_price,
    name_ar = coalesce(p_name_ar, name_ar),
    name = coalesce(p_name_ar, name),
    name_en = coalesce(p_name_en, name_en),
    name_ku = coalesce(p_name_ku, name_ku),
    description_ar = coalesce(p_description_ar, description_ar)
  WHERE id = v_id;
  RETURN jsonb_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_levo_card_product(numeric, text, text, text, text) TO authenticated;
