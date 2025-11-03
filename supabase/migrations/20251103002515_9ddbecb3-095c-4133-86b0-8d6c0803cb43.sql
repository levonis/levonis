-- Block anonymous/public access to profiles table
-- This prevents unauthenticated users from accessing user email addresses and personal data

CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- Ensure the existing authenticated user policy is still active
-- (Users can only view their own profile when authenticated)