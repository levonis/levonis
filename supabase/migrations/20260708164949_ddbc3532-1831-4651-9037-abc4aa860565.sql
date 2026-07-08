
-- 1) Assistance claim RPCs: ignore caller-supplied user id, always use auth.uid()
CREATE OR REPLACE FUNCTION public.claim_assistance_coupon(p_coupon_id UUID, p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT;
  v_max INTEGER;
  v_current INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT max_claims, claimed_count INTO v_max, v_current
    FROM assistance_coupons WHERE id = p_coupon_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الكوبون غير متوفر'; END IF;
  IF v_current >= v_max THEN RAISE EXCEPTION 'نفدت الكمية المتاحة'; END IF;
  v_code := 'AC-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  INSERT INTO assistance_coupon_claims (coupon_id, user_id, coupon_code)
    VALUES (p_coupon_id, v_uid, v_code);
  UPDATE assistance_coupons SET claimed_count = claimed_count + 1 WHERE id = p_coupon_id;
  RETURN v_code;
END; $$;

CREATE OR REPLACE FUNCTION public.claim_assistance_gift(p_gift_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_max INTEGER;
  v_current INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT max_claims, claimed_count INTO v_max, v_current
    FROM assistance_gifts WHERE id = p_gift_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الهدية غير متوفرة'; END IF;
  IF v_current >= v_max THEN RAISE EXCEPTION 'نفدت الكمية المتاحة'; END IF;
  INSERT INTO assistance_gift_claims (gift_id, user_id) VALUES (p_gift_id, v_uid);
  UPDATE assistance_gifts SET claimed_count = claimed_count + 1 WHERE id = p_gift_id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.claim_assistance_envelope(p_envelope_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_max_claims INTEGER;
  v_current INTEGER;
  v_is_limited BOOLEAN;
  v_max_discount NUMERIC;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT max_claims, claimed_count, is_limited, max_discount
    INTO v_max_claims, v_current, v_is_limited, v_max_discount
    FROM assistance_red_envelopes WHERE id = p_envelope_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الظرف غير متوفر'; END IF;
  IF v_is_limited AND v_max_claims IS NOT NULL AND v_current >= v_max_claims THEN
    RAISE EXCEPTION 'نفدت الكمية المتاحة';
  END IF;
  INSERT INTO assistance_envelope_claims (envelope_id, user_id, remaining_discount)
    VALUES (p_envelope_id, v_uid, v_max_discount);
  UPDATE assistance_red_envelopes SET claimed_count = claimed_count + 1 WHERE id = p_envelope_id;
  RETURN true;
END; $$;

-- 2) Stack game prize claim: require an unredeemed milestone claim
CREATE OR REPLACE FUNCTION public.claim_stack_prize_to_cart(p_milestone_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_milestone record;
  v_user_id uuid := auth.uid();
  v_existing_gift record;
  v_claim record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_milestone
    FROM stack_game_milestones
    WHERE id = p_milestone_id AND is_active = true;
  IF v_milestone IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'milestone_not_found');
  END IF;
  IF v_milestone.product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_product_configured');
  END IF;

  -- Require an unredeemed claim owned by the caller
  SELECT * INTO v_claim
    FROM stack_game_milestone_claims
    WHERE milestone_id = p_milestone_id
      AND user_id = v_user_id
      AND COALESCE(redeemed, false) = false
    FOR UPDATE;
  IF v_claim.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_valid_claim');
  END IF;

  SELECT * INTO v_existing_gift FROM cart_items
    WHERE user_id = v_user_id AND product_id = v_milestone.product_id AND is_gift = true;
  IF v_existing_gift IS NOT NULL THEN
    UPDATE stack_game_milestone_claims
       SET redeemed = true, redeemed_at = now()
     WHERE id = v_claim.id;
    RETURN jsonb_build_object('success', true, 'already_in_cart', true);
  END IF;

  INSERT INTO cart_items (
    user_id, product_id, product_option_id, selected_color,
    quantity, sale_type, is_gift, is_locked
  ) VALUES (
    v_user_id, v_milestone.product_id, v_milestone.selected_option_id, v_milestone.selected_color,
    1, 'direct', true, true
  );

  UPDATE stack_game_milestone_claims
     SET redeemed = true, redeemed_at = now()
   WHERE id = v_claim.id;

  RETURN jsonb_build_object('success', true, 'added', true);
END; $$;

-- 3) Remove plaintext PIN storage on physical Levo cards
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
      pin_hash, qr_token, nfc_token
    ) VALUES (
      v_num, right(v_num, 4), p_batch_label, auth.uid(),
      extensions.crypt(v_pin, extensions.gen_salt('bf', 8)),
      v_qr, v_nfc
    ) RETURNING id INTO v_id;

    v_cards := v_cards || jsonb_build_object(
      'id', v_id, 'card_number', v_num, 'pin', v_pin,
      'qr_token', v_qr, 'nfc_token', v_nfc
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'count', p_count, 'cards', v_cards);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_reveal_levo_batch(p_batch_label text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cards jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('success', false, 'error','forbidden');
  END IF;
  -- PIN is never stored in plaintext; return null so callers regenerate if needed.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'card_number', card_number, 'pin', NULL,
    'qr_token', qr_token, 'nfc_token', nfc_token, 'status', status
  ) ORDER BY created_at), '[]'::jsonb)
  INTO v_cards
  FROM public.levo_physical_cards
  WHERE (p_batch_label IS NULL AND batch_label IS NULL)
     OR batch_label = p_batch_label;
  RETURN jsonb_build_object('success', true, 'cards', v_cards);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_reveal_levo_card(p_card_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('success', false, 'error','forbidden');
  END IF;
  SELECT jsonb_build_object(
    'id', id, 'card_number', card_number, 'pin', NULL,
    'qr_token', qr_token, 'nfc_token', nfc_token, 'status', status
  ) INTO v
  FROM public.levo_physical_cards WHERE id = p_card_id;
  IF v IS NULL THEN RETURN jsonb_build_object('success', false, 'error','not_found'); END IF;
  RETURN jsonb_build_object('success', true, 'card', v);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_regen_levo_card_secrets(p_card_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
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
     SET pin_hash = extensions.crypt(v_pin, extensions.gen_salt('bf')),
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
END; $$;

ALTER TABLE public.levo_physical_cards DROP COLUMN IF EXISTS pin_plaintext;

-- 4) Merchant giveaway entries: remove winner-merchant branch that exposed all entrants
DROP POLICY IF EXISTS "Entrants merchants and admins can view entries" ON public.merchant_giveaway_entries;
CREATE POLICY "Entrants merchants and admins can view entries"
ON public.merchant_giveaway_entries FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'assistant'::app_role)
  OR EXISTS (
    SELECT 1 FROM merchant_applications ma
    WHERE ma.id = merchant_giveaway_entries.merchant_id
      AND ma.user_id = auth.uid()
  )
);

-- 5) merchant_public_profiles: add owner-scoped INSERT + DELETE policies
CREATE POLICY "Merchants can create their own public profile"
ON public.merchant_public_profiles FOR INSERT TO authenticated
WITH CHECK (
  id IN (SELECT id FROM merchant_applications WHERE user_id = auth.uid())
);

CREATE POLICY "Merchants or admins can delete public profile"
ON public.merchant_public_profiles FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR id IN (SELECT id FROM merchant_applications WHERE user_id = auth.uid())
);

-- 6) Print offers: restrict SELECT policy to authenticated users only
DROP POLICY IF EXISTS "Request owner, offer trader, or admin can view offers" ON public.print_offers;
CREATE POLICY "Request owner, offer trader, or admin can view offers"
ON public.print_offers FOR SELECT TO authenticated
USING (
  trader_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM community_print_requests r
    WHERE r.id = print_offers.request_id AND r.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);
