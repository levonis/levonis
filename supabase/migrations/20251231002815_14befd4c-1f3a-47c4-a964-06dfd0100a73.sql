-- Add delete policy for sellers
CREATE POLICY "Sellers can delete their own listings" 
ON public.user_listings 
FOR DELETE 
USING (
  auth.uid() = seller_id 
  AND NOT EXISTS (
    SELECT 1 FROM listing_transactions 
    WHERE listing_id = user_listings.id 
    AND status IN ('pending', 'confirmed', 'shipped', 'disputed')
  )
  AND NOT EXISTS (
    SELECT 1 FROM listing_conversations 
    WHERE listing_id = user_listings.id 
    AND status = 'disputed'
  )
);