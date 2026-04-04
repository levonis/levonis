-- Allow any authenticated user to read public profile fields
CREATE POLICY "Authenticated users can view public profile info"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Drop redundant old policies that are now covered by the new one
DROP POLICY IF EXISTS "Users can view own full profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;