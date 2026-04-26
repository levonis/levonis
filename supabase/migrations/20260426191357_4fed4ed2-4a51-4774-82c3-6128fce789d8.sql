ALTER TABLE public.loyalty_levels
  ADD COLUMN IF NOT EXISTS discount_percentage_max_amount NUMERIC NULL;

CREATE TABLE IF NOT EXISTS public.loyalty_percentage_discount_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  card_id UUID NOT NULL,
  level_id UUID NOT NULL,
  order_id UUID NULL,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lpdu_card ON public.loyalty_percentage_discount_usage(card_id);
CREATE INDEX IF NOT EXISTS idx_lpdu_user ON public.loyalty_percentage_discount_usage(user_id);

ALTER TABLE public.loyalty_percentage_discount_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own percentage discount usage" ON public.loyalty_percentage_discount_usage;
CREATE POLICY "Users view own percentage discount usage"
ON public.loyalty_percentage_discount_usage
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own percentage discount usage" ON public.loyalty_percentage_discount_usage;
CREATE POLICY "Users insert own percentage discount usage"
ON public.loyalty_percentage_discount_usage
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage percentage discount usage" ON public.loyalty_percentage_discount_usage;
CREATE POLICY "Admins manage percentage discount usage"
ON public.loyalty_percentage_discount_usage
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_card_percentage_discount_used(p_card_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(u.discount_amount), 0)::NUMERIC
  FROM public.loyalty_percentage_discount_usage u
  JOIN public.user_cards c ON c.id = u.card_id
  WHERE u.card_id = p_card_id
    AND u.used_at >= c.purchased_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_card_percentage_discount_used(UUID) TO authenticated, anon;