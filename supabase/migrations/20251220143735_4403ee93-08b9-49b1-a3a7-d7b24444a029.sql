-- Add restrictive baseline policy for profiles to ensure authentication is always required
-- This acts as a catch-all security layer
CREATE POLICY "Require authentication for all profile access"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Add restrictive baseline policy for orders table as well
CREATE POLICY "Require authentication for all order access"
ON public.orders
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);