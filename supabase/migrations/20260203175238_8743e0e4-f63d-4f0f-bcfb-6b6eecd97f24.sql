
-- Fix profiles_public view to use security_invoker for proper RLS enforcement
-- This ensures the view respects the RLS policies of the underlying profiles table

-- Drop and recreate the view with security_invoker enabled
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker = on)
AS
SELECT 
    id,
    username,
    full_name,
    avatar_url,
    selected_frame_id,
    active_card_frame_url,
    created_at,
    bio
FROM public.profiles;

-- Grant SELECT access to authenticated users on the public view
GRANT SELECT ON public.profiles_public TO authenticated;

-- Add comment explaining the purpose
COMMENT ON VIEW public.profiles_public IS 'Public-safe view of profiles table. Excludes sensitive fields (email, phone, etc.). Use this for public/community features.';
