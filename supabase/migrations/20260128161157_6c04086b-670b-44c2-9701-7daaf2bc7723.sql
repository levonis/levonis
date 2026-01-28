-- Drop all existing policies on print_offers
DROP POLICY IF EXISTS "Merchants can create offers on approved requests" ON print_offers;
DROP POLICY IF EXISTS "Users can view offers for approved requests" ON print_offers;
DROP POLICY IF EXISTS "Request owner can accept/reject offers" ON print_offers;
DROP POLICY IF EXISTS "Trader can update their offers" ON print_offers;

-- Create correct SELECT policy
CREATE POLICY "Anyone can view offers for community requests"
ON print_offers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM community_print_requests r
    WHERE r.id = print_offers.request_id
  )
);

-- Create correct INSERT policy for merchants
CREATE POLICY "Merchants can create offers"
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

-- Create UPDATE policy for traders to update their own offers
CREATE POLICY "Traders can update own offers"
ON print_offers
FOR UPDATE
TO authenticated
USING (trader_id = auth.uid())
WITH CHECK (trader_id = auth.uid());

-- Create UPDATE policy for request owners to accept/reject
CREATE POLICY "Request owners can update offer status"
ON print_offers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM community_print_requests r
    WHERE r.id = print_offers.request_id
    AND r.user_id = auth.uid()
  )
);