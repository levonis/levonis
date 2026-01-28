-- Create community_settings table for admin configurable settings
CREATE TABLE IF NOT EXISTS public.community_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.community_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read settings
CREATE POLICY "Anyone can read community settings" 
ON public.community_settings 
FOR SELECT 
USING (true);

-- Policy: Only admins can modify
CREATE POLICY "Only admins can modify community settings" 
ON public.community_settings 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Insert default settings
INSERT INTO public.community_settings (key, value, description)
VALUES 
  ('merchant_registration_fee', '{"amount": 25000, "currency": "IQD"}', 'رسوم تسجيل التاجر'),
  ('rejected_application_auto_delete_days', '{"days": 7}', 'عدد الأيام قبل حذف الطلبات المرفوضة تلقائياً'),
  ('max_customer_requests_per_day', '{"limit": 5}', 'الحد الأقصى لطلبات العميل يومياً')
ON CONFLICT (key) DO NOTHING;

-- Add suspension fields to community_customer_profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'community_customer_profiles' 
                 AND column_name = 'suspended_at') THEN
    ALTER TABLE public.community_customer_profiles ADD COLUMN suspended_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'community_customer_profiles' 
                 AND column_name = 'suspended_by') THEN
    ALTER TABLE public.community_customer_profiles ADD COLUMN suspended_by UUID;
  END IF;
END $$;

-- Add rejected_at field to merchant_applications for auto-cleanup
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'merchant_applications' 
                 AND column_name = 'rejected_at') THEN
    ALTER TABLE public.merchant_applications ADD COLUMN rejected_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Create trigger to auto-update updated_at on community_settings
CREATE OR REPLACE FUNCTION public.update_community_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_community_settings_updated_at ON public.community_settings;
CREATE TRIGGER update_community_settings_updated_at
BEFORE UPDATE ON public.community_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_community_settings_updated_at();

-- Enable realtime for community_settings
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_settings;