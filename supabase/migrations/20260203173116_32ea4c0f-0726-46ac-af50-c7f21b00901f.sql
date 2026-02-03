-- Add RLS policy for users to insert their own wallet transactions (deposit/withdrawal requests)
-- Users can only create pending deposit or withdrawal requests
CREATE POLICY "Users can insert their own wallet transactions"
ON public.wallet_transactions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND status = 'pending'
  AND type IN ('deposit', 'withdrawal')
);