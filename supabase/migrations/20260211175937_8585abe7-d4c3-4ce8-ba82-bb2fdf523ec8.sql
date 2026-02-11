
-- Fix product_offer_purchases: USING clause must include shipping_requested for UPDATE+RETURNING
DROP POLICY IF EXISTS "Users can update own purchases" ON public.product_offer_purchases;
DROP POLICY IF EXISTS "Users can request shipping for purchases" ON public.product_offer_purchases;

CREATE POLICY "Users can request shipping for purchases"
ON public.product_offer_purchases
FOR UPDATE
USING (
  auth.uid() = user_id 
  AND purchase_status = ANY (ARRAY['pending', 'purchased', 'shipping_requested'])
)
WITH CHECK (
  auth.uid() = user_id 
  AND purchase_status = ANY (ARRAY['pending', 'purchased', 'shipping_requested'])
);

-- Fix competition_prizes: USING clause must include shipping_requested for UPDATE+RETURNING
DROP POLICY IF EXISTS "Users can request prize shipping" ON public.competition_prizes;

CREATE POLICY "Users can request prize shipping"
ON public.competition_prizes
FOR UPDATE
USING (
  auth.uid() = user_id 
  AND status = ANY (ARRAY['pending', 'won', 'shipping_requested'])
)
WITH CHECK (
  auth.uid() = user_id 
  AND status = ANY (ARRAY['pending', 'won', 'shipping_requested'])
);
