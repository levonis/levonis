-- Add badge columns to merchant_applications
ALTER TABLE public.merchant_applications 
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS badge_tier TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS badge_override BOOLEAN NOT NULL DEFAULT false;

-- badge_tier values: 'none', 'silver', 'gold', 'diamond_1', 'diamond_2', 'diamond_3', 'diamond_4', 'emerald'
-- badge_override: when true, the admin has manually set the badge and auto-calculation is disabled

-- Create settings table for badge thresholds (admin-configurable)
CREATE TABLE IF NOT EXISTS public.merchant_badge_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_badge_settings ENABLE ROW LEVEL SECURITY;

-- Policies: admins can read/write, others can read
CREATE POLICY "Anyone can view badge settings" 
  ON public.merchant_badge_settings FOR SELECT 
  USING (true);

CREATE POLICY "Admins can manage badge settings" 
  ON public.merchant_badge_settings FOR ALL 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default thresholds
INSERT INTO public.merchant_badge_settings (setting_key, setting_value, description) VALUES
  ('silver_min', 11, 'الحد الأدنى للشارة الفضية (طلبات)'),
  ('silver_max', 50, 'الحد الأقصى للشارة الفضية (طلبات)'),
  ('gold_min', 51, 'الحد الأدنى للشارة الذهبية (طلبات)'),
  ('gold_max', 100, 'الحد الأقصى للشارة الذهبية (طلبات)'),
  ('diamond1_min', 101, 'الحد الأدنى للماسية 1 (طلبات)'),
  ('diamond2_monthly', 500, 'طلبات الشهر للماسية 2'),
  ('diamond3_monthly', 1000, 'طلبات الشهر للماسية 3'),
  ('diamond4_monthly', 2000, 'طلبات الشهر للماسية 4'),
  ('emerald_monthly', 3000, 'طلبات الشهر للزمردة'),
  ('continuity_months', 2, 'عدد الأشهر المتتالية المطلوبة للترقية')
ON CONFLICT (setting_key) DO NOTHING;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_merchant_badge_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_merchant_badge_settings_updated_at
  BEFORE UPDATE ON public.merchant_badge_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_merchant_badge_settings_updated_at();

-- Add comment for clarity
COMMENT ON COLUMN public.merchant_applications.is_verified IS 'شارة التوثيق الذهبية - يدوية من الأدمن';
COMMENT ON COLUMN public.merchant_applications.badge_tier IS 'مستوى شارة الطلبات: none, silver, gold, diamond_1-4, emerald';
COMMENT ON COLUMN public.merchant_applications.badge_override IS 'إذا كانت true، الأدمن عدّل الشارة يدويًا';