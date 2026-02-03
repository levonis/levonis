-- Create trigger function to clean up merchant_public_profiles when merchant_applications is deleted
CREATE OR REPLACE FUNCTION public.cleanup_merchant_public_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the corresponding public profile when a merchant application is deleted
  DELETE FROM public.merchant_public_profiles 
  WHERE id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on merchant_applications
DROP TRIGGER IF EXISTS on_merchant_application_delete ON public.merchant_applications;
CREATE TRIGGER on_merchant_application_delete
  AFTER DELETE ON public.merchant_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_merchant_public_profile();

-- Also clean up orphaned records now (public profiles without matching applications)
DELETE FROM public.merchant_public_profiles 
WHERE id NOT IN (
  SELECT id FROM public.merchant_applications WHERE status = 'approved'
);