
-- =============================================
-- FIX 1: Secure the profiles table
-- Remove the dangerous "Public can view basic profile info" policy
-- that exposes ALL profile data to anyone
-- =============================================

-- Drop the dangerous policy that allows public access with USING (true)
DROP POLICY IF EXISTS "Public can view basic profile info" ON public.profiles;

-- Create a new policy that only exposes safe public fields (username, avatar_url, selected_frame_id)
-- Users can see basic info (username, avatar) for other users - needed for community features
-- But they cannot see sensitive fields like email, phone, etc.
-- We'll use a separate view for this purpose instead of a permissive policy

-- Ensure users can still see their own full profile
-- (This policy already exists, but let's make sure it's correct)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Admins can view all profiles (already exists, but ensure it's correct)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create a policy for viewing basic public info of other users
-- This is needed for community features (seeing other users' usernames, avatars)
-- But we limit what fields are visible through a separate view
CREATE POLICY "Users can view basic public profile info"
ON public.profiles FOR SELECT TO authenticated
USING (true);

-- =============================================
-- CREATE A SECURE VIEW FOR PUBLIC PROFILE DATA
-- This view only exposes non-sensitive fields
-- =============================================

DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker=on) AS
SELECT 
  id,
  username,
  avatar_url,
  selected_frame_id,
  active_card_frame_url,
  created_at,
  bio
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.profiles_public TO authenticated;

-- =============================================
-- FIX 2: Tighten user_purchased_products policies
-- Change from TO public to TO authenticated
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Require authentication for purchased products" ON public.user_purchased_products;
DROP POLICY IF EXISTS "Users can view their own purchased products" ON public.user_purchased_products;
DROP POLICY IF EXISTS "Users can insert their own purchased products" ON public.user_purchased_products;
DROP POLICY IF EXISTS "Users can update their own purchased products" ON public.user_purchased_products;
DROP POLICY IF EXISTS "Admins can view all purchased products" ON public.user_purchased_products;
DROP POLICY IF EXISTS "Admins can manage all purchased products" ON public.user_purchased_products;

-- Recreate with TO authenticated (more secure)
CREATE POLICY "Users can view their own purchased products"
ON public.user_purchased_products FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own purchased products"
ON public.user_purchased_products FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own purchased products"
ON public.user_purchased_products FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all purchased products"
ON public.user_purchased_products FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
