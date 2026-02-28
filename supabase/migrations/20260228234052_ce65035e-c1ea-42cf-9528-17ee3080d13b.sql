
-- Assistance Coupons
CREATE TABLE public.assistance_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  discount_type TEXT NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  max_claims INTEGER NOT NULL DEFAULT 100,
  claimed_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assistance_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read assistance_coupons"
ON public.assistance_coupons FOR SELECT TO authenticated USING (true);

-- Assistance Coupon Claims
CREATE TABLE public.assistance_coupon_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.assistance_coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coupon_code TEXT NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coupon_id, user_id)
);

ALTER TABLE public.assistance_coupon_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own coupon claims"
ON public.assistance_coupon_claims FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own coupon claims"
ON public.assistance_coupon_claims FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Assistance Gifts
CREATE TABLE public.assistance_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID,
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  image_url TEXT,
  max_claims INTEGER NOT NULL DEFAULT 100,
  claimed_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assistance_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read assistance_gifts"
ON public.assistance_gifts FOR SELECT TO authenticated USING (true);

-- Assistance Gift Claims
CREATE TABLE public.assistance_gift_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id UUID NOT NULL REFERENCES public.assistance_gifts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_redeemed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gift_id, user_id)
);

ALTER TABLE public.assistance_gift_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own gift claims"
ON public.assistance_gift_claims FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gift claims"
ON public.assistance_gift_claims FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Assistance Red Envelopes
CREATE TABLE public.assistance_red_envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  spend_threshold NUMERIC NOT NULL DEFAULT 50000,
  discount_amount NUMERIC NOT NULL DEFAULT 5000,
  max_discount NUMERIC NOT NULL DEFAULT 15000,
  max_claims INTEGER,
  claimed_count INTEGER NOT NULL DEFAULT 0,
  is_limited BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assistance_red_envelopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read red envelopes"
ON public.assistance_red_envelopes FOR SELECT TO authenticated USING (true);

-- Assistance Envelope Claims
CREATE TABLE public.assistance_envelope_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id UUID NOT NULL REFERENCES public.assistance_red_envelopes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  remaining_discount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(envelope_id, user_id)
);

ALTER TABLE public.assistance_envelope_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own envelope claims"
ON public.assistance_envelope_claims FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own envelope claims"
ON public.assistance_envelope_claims FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Function to claim a coupon atomically
CREATE OR REPLACE FUNCTION public.claim_assistance_coupon(p_coupon_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_max INTEGER;
  v_current INTEGER;
BEGIN
  SELECT max_claims, claimed_count INTO v_max, v_current
  FROM assistance_coupons
  WHERE id = p_coupon_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الكوبون غير متوفر';
  END IF;

  IF v_current >= v_max THEN
    RAISE EXCEPTION 'نفدت الكمية المتاحة';
  END IF;

  v_code := 'AC-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  INSERT INTO assistance_coupon_claims (coupon_id, user_id, coupon_code)
  VALUES (p_coupon_id, p_user_id, v_code);

  UPDATE assistance_coupons SET claimed_count = claimed_count + 1 WHERE id = p_coupon_id;

  RETURN v_code;
END;
$$;

-- Function to claim a gift atomically
CREATE OR REPLACE FUNCTION public.claim_assistance_gift(p_gift_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max INTEGER;
  v_current INTEGER;
BEGIN
  SELECT max_claims, claimed_count INTO v_max, v_current
  FROM assistance_gifts
  WHERE id = p_gift_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الهدية غير متوفرة';
  END IF;

  IF v_current >= v_max THEN
    RAISE EXCEPTION 'نفدت الكمية المتاحة';
  END IF;

  INSERT INTO assistance_gift_claims (gift_id, user_id)
  VALUES (p_gift_id, p_user_id);

  UPDATE assistance_gifts SET claimed_count = claimed_count + 1 WHERE id = p_gift_id;

  RETURN true;
END;
$$;

-- Function to claim a red envelope atomically
CREATE OR REPLACE FUNCTION public.claim_assistance_envelope(p_envelope_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_claims INTEGER;
  v_current INTEGER;
  v_is_limited BOOLEAN;
  v_max_discount NUMERIC;
BEGIN
  SELECT max_claims, claimed_count, is_limited, max_discount
  INTO v_max_claims, v_current, v_is_limited, v_max_discount
  FROM assistance_red_envelopes
  WHERE id = p_envelope_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الظرف غير متوفر';
  END IF;

  IF v_is_limited AND v_max_claims IS NOT NULL AND v_current >= v_max_claims THEN
    RAISE EXCEPTION 'نفدت الكمية المتاحة';
  END IF;

  INSERT INTO assistance_envelope_claims (envelope_id, user_id, remaining_discount)
  VALUES (p_envelope_id, p_user_id, v_max_discount);

  UPDATE assistance_red_envelopes SET claimed_count = claimed_count + 1 WHERE id = p_envelope_id;

  RETURN true;
END;
$$;
