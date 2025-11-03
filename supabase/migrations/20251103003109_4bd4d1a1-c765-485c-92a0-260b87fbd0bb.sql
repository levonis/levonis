-- Drop old policy if exists and create new one
-- PostgreSQL doesn't support IF NOT EXISTS for policies, so we handle it differently
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
END $$;

-- Add explicit deny for anonymous users on profiles SELECT
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- Ensure owner-only access for authenticated users remains explicit
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);