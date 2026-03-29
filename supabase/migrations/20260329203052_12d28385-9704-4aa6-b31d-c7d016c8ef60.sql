-- Allow authenticated users to update store_printers when activating (status is pending and no buyer yet)
CREATE POLICY "Users can activate pending printers"
ON public.store_printers
FOR UPDATE
TO authenticated
USING (status = 'pending' AND (buyer_user_id IS NULL))
WITH CHECK (buyer_user_id = auth.uid() AND status = 'active');