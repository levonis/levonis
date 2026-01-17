-- Create redemption_settings table for admin to manage redemption options
CREATE TABLE public.redemption_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  redemption_type TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  description_ar TEXT,
  points_per_unit NUMERIC NOT NULL DEFAULT 1,
  unit_value NUMERIC NOT NULL DEFAULT 1,
  min_points NUMERIC NOT NULL DEFAULT 1000,
  max_daily_points NUMERIC DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  icon TEXT DEFAULT 'Ticket',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_coupons table to track user coupons from points redemption
CREATE TABLE public.user_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  coupon_code TEXT NOT NULL UNIQUE,
  discount_value NUMERIC NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'fixed',
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  source TEXT DEFAULT 'points_redemption',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_cards table for purchased loyalty cards
CREATE TABLE public.user_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  level_id UUID NOT NULL REFERENCES public.loyalty_levels(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  points_spent NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create card_exclusive_offers table for exclusive offers for card holders
CREATE TABLE public.card_exclusive_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  image_url TEXT,
  offer_type TEXT NOT NULL DEFAULT 'discount',
  offer_value NUMERIC,
  min_card_level_id UUID REFERENCES public.loyalty_levels(id),
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product_card_discounts table for product-specific card discounts
CREATE TABLE public.product_card_discounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES public.loyalty_levels(id) ON DELETE CASCADE,
  discount_percentage NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, level_id)
);

-- Create daily_redemption_log table to track daily redemption limits
CREATE TABLE public.daily_redemption_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  redemption_type TEXT NOT NULL,
  points_redeemed NUMERIC NOT NULL,
  redeemed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add columns to loyalty_levels for card purchase system
ALTER TABLE public.loyalty_levels 
ADD COLUMN IF NOT EXISTS purchase_price_points NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS free_shipping_min_order NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_purchasable BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS card_discounts_enabled BOOLEAN DEFAULT false;

-- Enable RLS on new tables
ALTER TABLE public.redemption_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_exclusive_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_card_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_redemption_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read redemption settings" ON public.redemption_settings FOR SELECT USING (true);
CREATE POLICY "Users can view their own coupons" ON public.user_coupons FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own coupons" ON public.user_coupons FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own cards" ON public.user_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own cards" ON public.user_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own cards" ON public.user_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can read exclusive offers" ON public.card_exclusive_offers FOR SELECT USING (true);
CREATE POLICY "Anyone can read product card discounts" ON public.product_card_discounts FOR SELECT USING (true);
CREATE POLICY "Users can view their own redemption log" ON public.daily_redemption_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own redemption log" ON public.daily_redemption_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Insert default redemption settings
INSERT INTO public.redemption_settings (redemption_type, name_ar, description_ar, points_per_unit, unit_value, min_points, max_daily_points, icon, display_order) VALUES
('coupon', 'تحويل إلى كوبون', 'احصل على كود خصم لاستخدامه في مشترياتك', 1000, 5000, 1000, 50000, 'Ticket', 1),
('tickets', 'تحويل إلى تذاكر المسابقات', 'احصل على تذاكر للمشاركة في المسابقات', 500, 1, 500, NULL, 'Trophy', 2);