
-- Update profiles_public view to include last_active_at for online status
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
    END AS bio,
    last_active_at
  FROM profiles;

GRANT SELECT ON public.profiles_public TO authenticated;
