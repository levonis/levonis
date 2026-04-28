
-- 0) Drop existing function (signature mismatch)
DROP FUNCTION IF EXISTS public.get_public_profiles(uuid[]) CASCADE;

-- 1) Drop the broad authenticated SELECT policy that exposes sensitive columns
DROP POLICY IF EXISTS "Authenticated users can view public profile info" ON public.profiles;

-- 2) Strict SELECT policy: only owner OR admin can read full profile rows
DROP POLICY IF EXISTS "Users can view their own full profile" ON public.profiles;
CREATE POLICY "Users can view their own full profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Public, safe view exposing only non-sensitive columns
DROP VIEW IF EXISTS public.profiles_public CASCADE;
CREATE VIEW public.profiles_public
WITH (security_invoker = true)
AS
SELECT
  id,
  full_name,
  username,
  avatar_url,
  cover_image_url,
  bio,
  gender,
  selected_frame_id,
  active_card_frame_url,
  last_active_at,
  created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated, anon;

-- 4) Recreate get_public_profiles with the new safe signature
CREATE OR REPLACE FUNCTION public.get_public_profiles(user_ids uuid[])
RETURNS TABLE (
  id uuid,
  full_name text,
  username text,
  avatar_url text,
  cover_image_url text,
  bio text,
  active_card_frame_url text,
  selected_frame_id uuid,
  last_active_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.username,
    p.avatar_url,
    p.cover_image_url,
    p.bio,
    p.active_card_frame_url,
    p.selected_frame_id,
    p.last_active_at
  FROM public.profiles p
  WHERE p.id = ANY(user_ids);
$$;

REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;
