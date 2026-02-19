
-- Merchant store discounts/promotions table
CREATE TABLE public.merchant_store_discounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL,
  merchant_store_name TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC DEFAULT 0,
  min_purchase_amount NUMERIC DEFAULT 0,
  gift_description TEXT,
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_store_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active discounts visible to all"
ON public.merchant_store_discounts FOR SELECT
USING (is_active = true);

CREATE POLICY "Merchants manage own discounts"
ON public.merchant_store_discounts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM merchant_applications ma 
    WHERE ma.id = merchant_store_discounts.merchant_id 
    AND ma.user_id = auth.uid() 
    AND ma.status = 'approved'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM merchant_applications ma 
    WHERE ma.id = merchant_store_discounts.merchant_id 
    AND ma.user_id = auth.uid() 
    AND ma.status = 'approved'
  )
);

-- Community cart items table
CREATE TABLE public.community_cart_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  merchant_id UUID NOT NULL,
  merchant_name TEXT,
  product_id UUID NOT NULL,
  product_title TEXT NOT NULL,
  product_image TEXT,
  product_price NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  discount_id UUID REFERENCES public.merchant_store_discounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.community_cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cart"
ON public.community_cart_items FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
