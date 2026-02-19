
-- Merchant Giveaways (admin creates, merchants participate)
CREATE TABLE public.merchant_giveaways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  product_id UUID REFERENCES public.products(id),
  prize_name_ar TEXT NOT NULL,
  prize_image_url TEXT,
  prize_value NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  winner_merchant_id UUID,
  max_participants INT,
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  draw_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_giveaways ENABLE ROW LEVEL SECURITY;

-- Everyone can view active/completed giveaways
CREATE POLICY "Anyone can view giveaways" ON public.merchant_giveaways
  FOR SELECT USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage giveaways" ON public.merchant_giveaways
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Merchant Giveaway Entries
CREATE TABLE public.merchant_giveaway_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES public.merchant_giveaways(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL,
  merchant_name TEXT NOT NULL,
  merchant_store_image TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(giveaway_id, user_id)
);

ALTER TABLE public.merchant_giveaway_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view entries" ON public.merchant_giveaway_entries
  FOR SELECT USING (true);

CREATE POLICY "Verified merchants can enter" ON public.merchant_giveaway_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage entries" ON public.merchant_giveaway_entries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Customer Special Coupons
CREATE TABLE public.customer_special_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  coupon_type TEXT NOT NULL DEFAULT 'percentage' CHECK (coupon_type IN ('percentage', 'free_delivery', 'free_product', 'fixed_amount')),
  discount_value NUMERIC DEFAULT 0,
  coupon_code TEXT,
  image_url TEXT,
  merchant_store_id UUID,
  merchant_store_name TEXT,
  product_id UUID REFERENCES public.products(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_uses INT,
  current_uses INT DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_special_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active coupons" ON public.customer_special_coupons
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage coupons" ON public.customer_special_coupons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update trigger for timestamps
CREATE TRIGGER update_merchant_giveaways_updated_at
  BEFORE UPDATE ON public.merchant_giveaways
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_special_coupons_updated_at
  BEFORE UPDATE ON public.customer_special_coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
