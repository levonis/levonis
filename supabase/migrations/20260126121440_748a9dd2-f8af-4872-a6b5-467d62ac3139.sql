-- إضافة حقل نوع المادة للمنتجات
ALTER TABLE public.merchant_products 
ADD COLUMN IF NOT EXISTS material_type text DEFAULT 'both' 
CHECK (material_type IN ('resin', 'filament', 'both'));

-- إضافة حقل التخصص للتجار
ALTER TABLE public.merchant_applications 
ADD COLUMN IF NOT EXISTS specialty text DEFAULT 'both' 
CHECK (specialty IN ('resin', 'filament', 'both'));

-- تحديث الـ public profile للتاجر ليشمل التخصص
ALTER TABLE public.merchant_public_profiles 
ADD COLUMN IF NOT EXISTS specialty text DEFAULT 'both';

-- تحديث الـ trigger ليشمل التخصص
CREATE OR REPLACE FUNCTION public.sync_merchant_public_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    INSERT INTO public.merchant_public_profiles (
      id, 
      display_name, 
      bio, 
      store_image_url, 
      social_links, 
      is_verified, 
      badge_tier, 
      selected_frame_id,
      specialty
    )
    VALUES (
      NEW.id, 
      NEW.display_name, 
      NEW.bio, 
      NEW.store_image_url, 
      NEW.social_links, 
      NEW.is_verified, 
      NEW.badge_tier, 
      NEW.selected_frame_id,
      NEW.specialty
    )
    ON CONFLICT (id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      bio = EXCLUDED.bio,
      store_image_url = EXCLUDED.store_image_url,
      social_links = EXCLUDED.social_links,
      is_verified = EXCLUDED.is_verified,
      badge_tier = EXCLUDED.badge_tier,
      selected_frame_id = EXCLUDED.selected_frame_id,
      specialty = EXCLUDED.specialty;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;