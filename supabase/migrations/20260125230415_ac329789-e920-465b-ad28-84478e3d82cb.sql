-- Create or replace function to sync merchant_applications to merchant_public_profiles
CREATE OR REPLACE FUNCTION public.sync_merchant_public_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert into merchant_public_profiles when merchant_applications is updated
  IF TG_OP = 'UPDATE' OR TG_OP = 'INSERT' THEN
    -- Only sync if status is 'approved'
    IF NEW.status = 'approved' THEN
      INSERT INTO public.merchant_public_profiles (
        id, display_name, store_image_url, bio, city, social_links, selected_frame_id, is_verified, updated_at
      )
      VALUES (
        NEW.id, 
        NEW.display_name, 
        NEW.store_image_url, 
        NEW.bio, 
        NEW.city, 
        NEW.social_links, 
        NEW.selected_frame_id,
        COALESCE(NEW.is_verified, false),
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        store_image_url = EXCLUDED.store_image_url,
        bio = EXCLUDED.bio,
        city = EXCLUDED.city,
        social_links = EXCLUDED.social_links,
        selected_frame_id = EXCLUDED.selected_frame_id,
        is_verified = EXCLUDED.is_verified,
        updated_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS sync_merchant_public_profile_trigger ON public.merchant_applications;

-- Create trigger to sync on insert or update
CREATE TRIGGER sync_merchant_public_profile_trigger
AFTER INSERT OR UPDATE ON public.merchant_applications
FOR EACH ROW
EXECUTE FUNCTION public.sync_merchant_public_profile();