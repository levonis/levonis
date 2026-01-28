
-- =============================================
-- UPDATE profiles_public view to include full_name
-- full_name is semi-public since users display it in community activities
-- (comments, ratings, marketplace interactions)
-- =============================================

DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker=on) AS
SELECT 
  id,
  username,
  full_name,  -- Added: needed for community display (comments, ratings)
  avatar_url,
  selected_frame_id,
  active_card_frame_url,
  created_at,
  bio
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.profiles_public TO authenticated;

COMMENT ON VIEW public.profiles_public IS 'Public profile data view - exposes username, full_name, avatar, bio, frame. Use this view when displaying other users profiles in community features. Excludes sensitive fields: email, phone_number, governorate, telegram_chat_id, birth_date.';
