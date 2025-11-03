-- Remove the overly broad RESTRICTIVE false policy (negative security pattern)
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;

-- Ensure we have explicit PERMISSIVE policies with auth.uid() checks
-- This is better security practice than blocking with 'false'

-- Policy for authenticated users to view their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy for authenticated users to update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Note: No INSERT or DELETE policies - those are handled by the trigger
-- No policy for 'anon' role means anonymous users have no access by default
-- This is the correct security pattern: explicit allow for authenticated, implicit deny for others