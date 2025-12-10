-- Fix user_wallets SELECT policies to be restricted to authenticated users only

-- Drop and recreate the SELECT policies with proper role restriction
DROP POLICY IF EXISTS "Users can view their own wallet" ON public.user_wallets;
DROP POLICY IF EXISTS "Admins can view all wallets" ON public.user_wallets;

-- Recreate with TO authenticated restriction
CREATE POLICY "Users can view their own wallet" 
ON public.user_wallets 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets" 
ON public.user_wallets 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));