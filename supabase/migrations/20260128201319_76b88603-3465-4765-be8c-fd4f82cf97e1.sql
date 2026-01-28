
-- =============================================
-- IMPROVED FIX: Restrict profiles table access properly
-- Only allow users to see their own profile data directly
-- Other users can only see data through the profiles_public view
-- =============================================

-- Drop the overly permissive policy we just created
DROP POLICY IF EXISTS "Users can view basic public profile info" ON public.profiles;

-- Now authenticated users can ONLY see:
-- 1. Their own profile (via "Users can view their own profile" policy)
-- 2. All profiles if admin (via "Admins can view all profiles" policy)
-- 3. Public profile data via profiles_public view

-- Add comments to the view for clarity
COMMENT ON VIEW public.profiles_public IS 'Public profile data view - only exposes non-sensitive fields (username, avatar, bio, frame). Use this view when displaying other users profiles in community features.';
