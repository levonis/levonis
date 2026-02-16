
-- Drop the auto-create community profile trigger (users should explicitly join)
DROP TRIGGER IF EXISTS on_profile_update_ensure_community ON public.profiles;
DROP FUNCTION IF EXISTS public.ensure_community_customer_profile();
