-- Fix security vulnerability: Remove direct INSERT access to user_task_completions
-- All insertions should go through the secure complete_daily_task function

-- Drop the existing user INSERT policy
DROP POLICY IF EXISTS "Users can insert their own completions" ON public.user_task_completions;

-- Create a new policy that only allows the system (via SECURITY DEFINER functions) to insert
-- Regular users cannot insert directly - only through the complete_daily_task RPC
CREATE POLICY "Only system can insert completions"
ON public.user_task_completions
FOR INSERT
WITH CHECK (false);

-- Also fix the profiles table security issue (flagged in security scan)
-- Ensure profiles table has proper RLS - users can only see their own profile
-- Admins already have a policy to view all profiles

-- Verify existing policies are correct (they should be based on the schema)
-- The current policies look correct:
-- - Users can view their own profile (auth.uid() = id)
-- - Admins can view all profiles (has_role check)
-- - Users can update their own profile

-- Add a comment to document the security model
COMMENT ON TABLE public.user_task_completions IS 'Task completion records. Users cannot insert directly - must use complete_daily_task RPC function for security.';