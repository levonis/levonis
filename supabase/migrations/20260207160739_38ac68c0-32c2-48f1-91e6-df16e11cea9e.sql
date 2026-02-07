-- Fix admin users visibility issue
-- The RESTRICTIVE policy is blocking admin access because it requires auth.uid() which is correct
-- But the issue is that admins need to see ALL profiles, not just their own

-- First, let's check and update the RLS policies

-- Drop the existing admin policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Recreate the admin policy with proper permissions
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Also ensure admins can update any profile if needed
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

CREATE POLICY "Admins can update all profiles"
ON profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));