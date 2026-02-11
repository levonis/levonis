-- Fix merchant_applications UPDATE RLS to allow draft status editing
DROP POLICY IF EXISTS "Users can update their own merchant application (limited)" ON public.merchant_applications;
CREATE POLICY "Users can update their own merchant application (limited)" 
ON public.merchant_applications 
FOR UPDATE 
USING (auth.uid() = user_id AND status IN ('draft', 'pending', 'rejected'));
