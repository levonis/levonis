
-- Create trigger to sync badge changes from merchant_applications to merchant_public_profiles
CREATE OR REPLACE FUNCTION public.sync_merchant_badges_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync is_verified and badge_tier to merchant_public_profiles
  UPDATE public.merchant_public_profiles
  SET 
    is_verified = NEW.is_verified,
    badge_tier = NEW.badge_tier
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_sync_merchant_badges ON public.merchant_applications;

-- Create trigger on merchant_applications
CREATE TRIGGER trigger_sync_merchant_badges
AFTER INSERT OR UPDATE OF is_verified, badge_tier ON public.merchant_applications
FOR EACH ROW
EXECUTE FUNCTION public.sync_merchant_badges_to_profile();
