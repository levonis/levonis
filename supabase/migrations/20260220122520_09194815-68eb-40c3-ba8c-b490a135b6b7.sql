
-- Drop the old profiles_public view and recreate it to hide avatar from non-owners
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker=on) AS
  SELECT 
    id,
    username,
    full_name,
    CASE 
      WHEN id = auth.uid() OR public.has_role(auth.uid(), 'admin') THEN avatar_url
      ELSE NULL
    END AS avatar_url,
    selected_frame_id,
    active_card_frame_url,
    created_at,
    CASE 
      WHEN id = auth.uid() OR public.has_role(auth.uid(), 'admin') THEN bio
      ELSE NULL
    END AS bio
  FROM profiles;

-- Update community_customer_profiles SELECT policy to hide sensitive fields
-- Drop old policy and create a restrictive one
DROP POLICY IF EXISTS "Authenticated users can view basic profiles" ON public.community_customer_profiles;

-- Allow users to view their own full profile
CREATE POLICY "Users can view own community profile"
  ON public.community_customer_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow other authenticated users to view only non-sensitive data (no avatar, no bio, no display_name)
-- We'll use a view for public-facing data instead

-- Create a public view for community customer profiles that hides personal info
CREATE OR REPLACE VIEW public.community_customer_profiles_public
WITH (security_invoker=on) AS
  SELECT 
    id,
    user_id,
    CASE 
      WHEN user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') THEN display_name
      ELSE NULL
    END AS display_name,
    CASE 
      WHEN user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') THEN bio
      ELSE NULL
    END AS bio,
    CASE 
      WHEN user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') THEN avatar_url
      ELSE NULL
    END AS avatar_url,
    frame_url,
    total_requests_made,
    total_requests_received,
    total_spent,
    reputation_score,
    is_verified,
    is_suspended,
    created_at,
    updated_at
  FROM community_customer_profiles;
