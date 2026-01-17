-- Add missing columns to loyalty_levels for card purchase system
ALTER TABLE public.loyalty_levels
ADD COLUMN IF NOT EXISTS is_purchasable boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS purchase_price_points integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS duration_days integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS free_shipping_min_order numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS card_discounts_enabled boolean DEFAULT false;

-- Create user_cards table for tracking user purchased cards
CREATE TABLE IF NOT EXISTS public.user_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  level_id UUID NOT NULL REFERENCES public.loyalty_levels(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  points_paid INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on user_cards
ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_cards
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_cards' AND policyname = 'Users can view their own cards') THEN
    CREATE POLICY "Users can view their own cards" ON public.user_cards
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_cards' AND policyname = 'Users can insert their own cards') THEN
    CREATE POLICY "Users can insert their own cards" ON public.user_cards
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- Create card_exclusive_offers table if not exists
CREATE TABLE IF NOT EXISTS public.card_exclusive_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  min_card_level_id UUID REFERENCES public.loyalty_levels(id) ON DELETE SET NULL,
  offer_type TEXT DEFAULT 'discount',
  offer_value NUMERIC DEFAULT 0,
  image_url TEXT,
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on card_exclusive_offers
ALTER TABLE public.card_exclusive_offers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for card_exclusive_offers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'card_exclusive_offers' AND policyname = 'Anyone can view active offers') THEN
    CREATE POLICY "Anyone can view active offers" ON public.card_exclusive_offers
      FOR SELECT USING (is_active = true);
  END IF;
END
$$;

-- Create product_card_discounts table for product-level card discounts
CREATE TABLE IF NOT EXISTS public.product_card_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES public.loyalty_levels(id) ON DELETE CASCADE,
  discount_percentage NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_id, level_id)
);

-- Enable RLS on product_card_discounts
ALTER TABLE public.product_card_discounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for product_card_discounts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_card_discounts' AND policyname = 'Anyone can view active discounts') THEN
    CREATE POLICY "Anyone can view active discounts" ON public.product_card_discounts
      FOR SELECT USING (is_active = true);
  END IF;
END
$$;