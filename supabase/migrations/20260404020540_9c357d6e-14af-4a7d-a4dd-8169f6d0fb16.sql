
-- Discount limits per card level per category
CREATE TABLE public.card_discount_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level_id UUID NOT NULL REFERENCES public.loyalty_levels(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  max_uses INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(level_id, category_id)
);

ALTER TABLE public.card_discount_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read discount limits"
  ON public.card_discount_limits FOR SELECT TO authenticated
  USING (true);

-- Track actual usage per user per card per category
CREATE TABLE public.card_discount_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  card_id UUID NOT NULL REFERENCES public.user_cards(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES public.loyalty_levels(id),
  category_id UUID NOT NULL REFERENCES public.categories(id),
  order_id UUID,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.card_discount_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own discount usage"
  ON public.card_discount_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert discount usage"
  ON public.card_discount_usage FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Check if user can use card discount for a category
CREATE OR REPLACE FUNCTION public.check_card_discount(
  p_user_id UUID,
  p_category_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_card RECORD;
  v_limit RECORD;
  v_used INTEGER;
BEGIN
  -- Get active card
  SELECT uc.id AS card_id, uc.level_id, ll.discount_percentage
  INTO v_card
  FROM user_cards uc
  JOIN loyalty_levels ll ON ll.id = uc.level_id
  WHERE uc.user_id = p_user_id AND uc.is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_card.discount_percentage IS NULL OR v_card.discount_percentage <= 0 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_card');
  END IF;

  -- Check if there's a limit for this category
  SELECT * INTO v_limit
  FROM card_discount_limits
  WHERE level_id = v_card.level_id AND category_id = p_category_id;

  -- No limit configured = unlimited usage
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', true, 'discount_percentage', v_card.discount_percentage, 'remaining', -1);
  END IF;

  -- Count usage
  SELECT COUNT(*) INTO v_used
  FROM card_discount_usage
  WHERE user_id = p_user_id
    AND card_id = v_card.card_id
    AND category_id = p_category_id;

  IF v_used >= v_limit.max_uses THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'limit_reached', 'max_uses', v_limit.max_uses, 'used', v_used);
  END IF;

  RETURN jsonb_build_object(
    'eligible', true,
    'discount_percentage', v_card.discount_percentage,
    'remaining', v_limit.max_uses - v_used,
    'max_uses', v_limit.max_uses
  );
END;
$$;

-- Record discount usage
CREATE OR REPLACE FUNCTION public.use_card_discount(
  p_user_id UUID,
  p_category_id UUID,
  p_order_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_card RECORD;
  v_check JSONB;
BEGIN
  -- First check eligibility
  v_check := public.check_card_discount(p_user_id, p_category_id);

  IF NOT (v_check->>'eligible')::boolean THEN
    RETURN v_check;
  END IF;

  -- Get active card
  SELECT uc.id AS card_id, uc.level_id
  INTO v_card
  FROM user_cards uc
  WHERE uc.user_id = p_user_id AND uc.is_active = true
  LIMIT 1;

  -- Record usage
  INSERT INTO card_discount_usage (user_id, card_id, level_id, category_id, order_id)
  VALUES (p_user_id, v_card.card_id, v_card.level_id, p_category_id, p_order_id);

  RETURN jsonb_build_object('success', true, 'discount_percentage', v_check->>'discount_percentage');
END;
$$;

-- Insert default limit: VIP Plus → Printers → 1 use
INSERT INTO public.card_discount_limits (level_id, category_id, max_uses)
VALUES ('bbe99ac7-3cdc-47da-b986-1f03db0c37f9', '3cd72a43-3af6-4adb-83e4-a482b4feca25', 1);
