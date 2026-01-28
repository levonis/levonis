-- Fix merchant_ratings RLS policy to be simpler and correct
DROP POLICY IF EXISTS "Customers can rate completed requests" ON public.merchant_ratings;

CREATE POLICY "Customers can insert ratings"
ON public.merchant_ratings 
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = customer_id AND
  EXISTS (
    SELECT 1 FROM community_print_requests pr
    WHERE pr.id = merchant_ratings.request_id
    AND pr.user_id = auth.uid()
    AND pr.status = 'delivered'
  )
);

-- Also fix the type check constraint to include 'spend'
ALTER TABLE public.points_transactions DROP CONSTRAINT IF EXISTS points_transactions_type_check;

ALTER TABLE public.points_transactions ADD CONSTRAINT points_transactions_type_check 
CHECK (type = ANY (ARRAY[
  'earned'::text, 
  'earn'::text, 
  'redeemed'::text, 
  'redeem'::text, 
  'converted'::text, 
  'adjustment'::text,
  'spend'::text
]));