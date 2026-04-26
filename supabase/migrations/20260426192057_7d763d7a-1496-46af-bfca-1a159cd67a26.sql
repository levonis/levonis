-- 1) Add new columns to loyalty_levels
ALTER TABLE public.loyalty_levels
  ADD COLUMN IF NOT EXISTS free_shipping_methods JSONB NOT NULL DEFAULT '["standard"]'::jsonb,
  ADD COLUMN IF NOT EXISTS free_shipping_max_uses INTEGER;

COMMENT ON COLUMN public.loyalty_levels.free_shipping_methods IS 'Array of delivery method_keys eligible for free shipping (e.g., ["standard","personal"])';
COMMENT ON COLUMN public.loyalty_levels.free_shipping_max_uses IS 'Max number of free shipping uses during card validity. NULL = unlimited.';

-- 2) Tracking table for free shipping usage
CREATE TABLE IF NOT EXISTS public.loyalty_free_shipping_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  card_id UUID NOT NULL REFERENCES public.user_cards(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES public.loyalty_levels(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  delivery_method_key TEXT NOT NULL,
  saved_amount NUMERIC NOT NULL DEFAULT 0,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_free_shipping_usage_card ON public.loyalty_free_shipping_usage(card_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_free_shipping_usage_user ON public.loyalty_free_shipping_usage(user_id);

ALTER TABLE public.loyalty_free_shipping_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own free shipping usage"
  ON public.loyalty_free_shipping_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own free shipping usage"
  ON public.loyalty_free_shipping_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all free shipping usage"
  ON public.loyalty_free_shipping_usage FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3) RPC: count free shipping uses for a card since purchase
CREATE OR REPLACE FUNCTION public.get_card_free_shipping_used(p_card_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::INTEGER, 0)
  FROM public.loyalty_free_shipping_usage u
  JOIN public.user_cards c ON c.id = u.card_id
  WHERE u.card_id = p_card_id
    AND u.used_at >= c.purchased_at;
$$;