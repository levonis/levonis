-- Fix RLS policy for print_offers to check community_print_requests table
DROP POLICY IF EXISTS "Anyone authenticated can create offers on approved requests" ON print_offers;

CREATE POLICY "Merchants can create offers on approved requests"
ON print_offers
FOR INSERT
TO authenticated
WITH CHECK (
  trader_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM community_print_requests r
    WHERE r.id = request_id 
    AND r.status = 'approved'
    AND r.accepted_offer_id IS NULL
    AND r.user_id != auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM merchant_applications ma
    WHERE ma.user_id = auth.uid()
    AND ma.status = 'approved'
  )
);