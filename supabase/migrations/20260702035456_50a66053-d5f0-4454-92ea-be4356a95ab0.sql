
-- =============================================================
-- Levo card PIN/QR/NFC + Reserved physical-card product + Coupon logic
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- 1) Extend levo_physical_cards with PIN, tokens, and lockout
ALTER TABLE public.levo_physical_cards
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS qr_token text,
  ADD COLUMN IF NOT EXISTS nfc_token text,
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS ux_levo_cards_qr_token ON public.levo_physical_cards(qr_token) WHERE qr_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_levo_cards_nfc_token ON public.levo_physical_cards(nfc_token) WHERE nfc_token IS NOT NULL;

-- 2) Products flagged as system reserved (cannot be deleted)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_system_reserved boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.prevent_system_reserved_product_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.is_system_reserved THEN
    RAISE EXCEPTION 'system_reserved_product_cannot_be_deleted' USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_prevent_system_reserved_product_delete ON public.products;
CREATE TRIGGER trg_prevent_system_reserved_product_delete
  BEFORE DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.prevent_system_reserved_product_delete();

-- 3) Create the reserved Levo physical-card product (idempotent)
DO $$
DECLARE
  v_product_id uuid := '00000000-0000-4000-8000-00000000ca1d'::uuid;
BEGIN
  INSERT INTO public.products (
    id, name, name_ar, name_en, name_ku,
    description_ar, description_en, description_ku,
    slug, price, availability_type, in_stock, has_in_stock,
    is_system_reserved, featured, display_order, currency
  )
  VALUES (
    v_product_id,
    'بطاقة ليفو الفيزيائية',
    'بطاقة ليفو الفيزيائية',
    'Levo Physical Card',
    'کارتی فیزیکی لێڤۆ',
    'بطاقة ليفو الفيزيائية الخاصة بك — تصلك إلى المنزل، ثم فعّلها لتفعيل عضويتك وتحصل على المزايا.',
    'Your Levo physical card — shipped to your home. Activate it to unlock membership benefits.',
    'کارتی فیزیکی لێڤۆی تایبەت بە تۆ — بۆ ماڵ دەگات، پاشان چالاکی بکە بۆ بەدەستهێنانی سوودەکان.',
    'levo-card',
    25000,
    'in_stock', true, true,
    true, true, 0, 'IQD'
  )
  ON CONFLICT (id) DO UPDATE SET is_system_reserved = true;

  -- Point default settings at the reserved product
  INSERT INTO public.default_settings (setting_key, setting_value, levo_physical_card_product_id)
  VALUES ('levo_card_product', jsonb_build_object('product_id', v_product_id::text), v_product_id)
  ON CONFLICT (setting_key) DO UPDATE
    SET levo_physical_card_product_id = EXCLUDED.levo_physical_card_product_id,
        setting_value = EXCLUDED.setting_value,
        updated_at = now();
END $$;

-- Helper: fetch the reserved product id
CREATE OR REPLACE FUNCTION public.get_levo_card_product_id()
RETURNS uuid LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT '00000000-0000-4000-8000-00000000ca1d'::uuid
$$;
GRANT EXECUTE ON FUNCTION public.get_levo_card_product_id() TO anon, authenticated;

-- 4) Helper: generate 4-digit PIN and 32-char random token
CREATE OR REPLACE FUNCTION public.generate_levo_pin()
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT lpad((floor(random() * 10000))::int::text, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.generate_levo_token()
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT encode(extensions.gen_random_bytes(18), 'base64');
$$;

-- 5) Replace admin_generate_levo_cards to emit PIN, QR token, NFC token
DROP FUNCTION IF EXISTS public.admin_generate_levo_cards(integer, text);

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
      'id', v_id,
      'card_number', v_num,
      'pin', v_pin,
      'qr_token', v_qr,
      'nfc_token', v_nfc
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'count', p_count, 'cards', v_cards);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_generate_levo_cards(integer, text) TO authenticated;

-- 6) Replace levo_activate_card: PIN is mandatory; accepts card_number OR qr/nfc token
DROP FUNCTION IF EXISTS public.levo_activate_card(text);

CREATE OR REPLACE FUNCTION public.levo_activate_card(
  p_card_number text DEFAULT NULL,
  p_pin text DEFAULT NULL,
  p_qr_token text DEFAULT NULL,
  p_nfc_token text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_num text;
  v_pin text := regexp_replace(coalesce(p_pin,''), '\D', '', 'g');
  v_card public.levo_physical_cards%ROWTYPE;
  v_assignment_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthenticated'); END IF;
  IF length(v_pin) <> 4 THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_pin'); END IF;

  -- Locate card via card_number OR qr/nfc token
  IF p_qr_token IS NOT NULL AND length(p_qr_token) > 0 THEN
    SELECT * INTO v_card FROM public.levo_physical_cards WHERE qr_token = p_qr_token FOR UPDATE;
  ELSIF p_nfc_token IS NOT NULL AND length(p_nfc_token) > 0 THEN
    SELECT * INTO v_card FROM public.levo_physical_cards WHERE nfc_token = p_nfc_token FOR UPDATE;
  ELSE
    v_num := public.normalize_levo_card_number(p_card_number);
    IF length(v_num) <> 16 THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_length'); END IF;
    SELECT * INTO v_card FROM public.levo_physical_cards WHERE card_number = v_num FOR UPDATE;
  END IF;

  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  IF v_card.status = 'revoked' THEN RETURN jsonb_build_object('success', false, 'error', 'revoked'); END IF;

  -- Rate limit: locked?
  IF v_card.locked_until IS NOT NULL AND v_card.locked_until > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'locked', 'locked_until', v_card.locked_until);
  END IF;

  -- Verify PIN
  IF v_card.pin_hash IS NULL OR v_card.pin_hash <> extensions.crypt(v_pin, v_card.pin_hash) THEN
    UPDATE public.levo_physical_cards
      SET failed_attempts = failed_attempts + 1,
          locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END,
          updated_at = now()
      WHERE id = v_card.id;
    RETURN jsonb_build_object('success', false, 'error', 'invalid_pin');
  END IF;

  IF EXISTS(SELECT 1 FROM public.levo_card_assignments WHERE card_id = v_card.id AND released_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'card_in_use');
  END IF;
  IF EXISTS(SELECT 1 FROM public.levo_card_assignments WHERE user_id = v_uid AND released_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_has_card');
  END IF;

  INSERT INTO public.levo_card_assignments(card_id, user_id) VALUES (v_card.id, v_uid)
    RETURNING id INTO v_assignment_id;
  UPDATE public.levo_physical_cards
    SET status='assigned', failed_attempts = 0, locked_until = NULL, updated_at = now()
    WHERE id = v_card.id;

  RETURN jsonb_build_object('success', true, 'assignment_id', v_assignment_id, 'card_id', v_card.id, 'last4', v_card.card_number_last4);
END; $$;

GRANT EXECUTE ON FUNCTION public.levo_activate_card(text, text, text, text) TO authenticated;

-- 7) Coupon validator: enforce applies_to_levo_card_only + block regular coupons on Levo product
DROP FUNCTION IF EXISTS public.validate_coupon_with_rate_limit(text);
DROP FUNCTION IF EXISTS public.validate_coupon_with_rate_limit(text, uuid[]);

CREATE OR REPLACE FUNCTION public.validate_coupon_with_rate_limit(
  coupon_code text,
  p_cart_product_ids uuid[] DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  coupon_record RECORD;
  user_usage_count INTEGER;
  recent_attempts INTEGER;
  current_user_id UUID;
  max_attempts INTEGER := 5;
  v_levo_product uuid := public.get_levo_card_product_id();
  v_cart_has_levo boolean := false;
  v_cart_has_other boolean := false;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO recent_attempts
      FROM public.coupon_validation_attempts
      WHERE user_id = current_user_id AND created_at > NOW() - INTERVAL '1 minute';
    IF recent_attempts >= max_attempts THEN
      RETURN jsonb_build_object('valid', false, 'error', 'تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار دقيقة واحدة.', 'rate_limited', true);
    END IF;
  END IF;

  INSERT INTO public.coupon_validation_attempts (user_id, attempted_code, success)
    VALUES (current_user_id, LEFT(coupon_code, 50), false);

  SELECT * INTO coupon_record
    FROM public.coupons
    WHERE code = coupon_code AND active = true
      AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'كوبون غير صالح أو منتهي الصلاحية');
  END IF;

  IF coupon_record.max_uses IS NOT NULL AND coupon_record.current_uses >= coupon_record.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'تم استخدام هذا الكوبون الحد الأقصى من المرات');
  END IF;

  IF current_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO user_usage_count
      FROM public.coupon_usage
      WHERE coupon_id = coupon_record.id AND user_id = current_user_id;
    IF user_usage_count > 0 THEN
      RETURN jsonb_build_object('valid', false, 'error', 'لقد استخدمت هذا الكوبون من قبل');
    END IF;
  END IF;

  -- Levo-card coupon vs cart contents
  IF p_cart_product_ids IS NOT NULL THEN
    v_cart_has_levo  := v_levo_product = ANY(p_cart_product_ids);
    v_cart_has_other := EXISTS (SELECT 1 FROM unnest(p_cart_product_ids) x WHERE x <> v_levo_product);

    IF coupon_record.applies_to_levo_card_only THEN
      IF NOT v_cart_has_levo THEN
        RETURN jsonb_build_object('valid', false, 'error', 'هذا الكوبون يعمل فقط عند وجود بطاقة ليفو الفيزيائية في السلة', 'code_key', 'COUPON_LEVO_ONLY');
      END IF;
      IF v_cart_has_other THEN
        RETURN jsonb_build_object('valid', false, 'error', 'كوبون بطاقة ليفو لا يعمل مع منتجات أخرى في نفس الطلب', 'code_key', 'COUPON_LEVO_ONLY_MIXED');
      END IF;
    ELSE
      IF v_cart_has_levo THEN
        RETURN jsonb_build_object('valid', false, 'error', 'الكوبونات العادية لا تعمل على بطاقة ليفو', 'code_key', 'COUPON_NOT_FOR_LEVO');
      END IF;
    END IF;
  END IF;

  UPDATE public.coupon_validation_attempts
    SET success = true
    WHERE user_id = current_user_id
      AND attempted_code = LEFT(coupon_code, 50)
      AND created_at > NOW() - INTERVAL '1 second';

  RETURN jsonb_build_object(
    'valid', true,
    'id', coupon_record.id,
    'code', coupon_record.code,
    'discount_type', coupon_record.discount_type,
    'discount_value', coupon_record.discount_value,
    'min_purchase_amount', coupon_record.min_purchase_amount,
    'applicable_delivery_method', coupon_record.applicable_delivery_method,
    'applies_to_levo_card_only', coupon_record.applies_to_levo_card_only
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.validate_coupon_with_rate_limit(text, uuid[]) TO authenticated, anon;
