-- Allow customers to create their own escrow transactions when accepting a print offer.
-- This was missing, causing "permission denied" / RLS violation on offer acceptance.

CREATE POLICY "Customers can create their own escrow transactions"
ON public.escrow_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.print_offers po
    WHERE po.id = escrow_transactions.offer_id
      AND po.request_id = escrow_transactions.request_id
      AND po.trader_id = escrow_transactions.merchant_id
  )
  AND EXISTS (
    SELECT 1 FROM public.community_print_requests r
    WHERE r.id = escrow_transactions.request_id
      AND r.user_id = auth.uid()
  )
);