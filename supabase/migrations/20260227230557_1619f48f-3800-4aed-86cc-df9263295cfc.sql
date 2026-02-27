-- Prevent storing base64 data URIs in avatar_url (they cause HTTP 431 errors)
CREATE OR REPLACE FUNCTION public.prevent_base64_avatar()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.avatar_url IS NOT NULL AND NEW.avatar_url LIKE 'data:%' THEN
    NEW.avatar_url := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER prevent_base64_avatar_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_base64_avatar();

-- Also protect community_customer_profiles
CREATE TRIGGER prevent_base64_avatar_community_trigger
BEFORE INSERT OR UPDATE ON public.community_customer_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_base64_avatar();