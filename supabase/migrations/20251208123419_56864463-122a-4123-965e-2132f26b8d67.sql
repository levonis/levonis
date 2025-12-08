-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "System can insert wallets" ON public.user_wallets;
DROP POLICY IF EXISTS "System can update wallets" ON public.user_wallets;

-- Create admin-only INSERT policy
-- Wallet creation happens through SECURITY DEFINER triggers
CREATE POLICY "Admins can insert wallets"
ON public.user_wallets
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create admin-only UPDATE policy
-- Balance updates happen through SECURITY DEFINER triggers (process_wallet_transaction)
CREATE POLICY "Admins can update wallets"
ON public.user_wallets
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));