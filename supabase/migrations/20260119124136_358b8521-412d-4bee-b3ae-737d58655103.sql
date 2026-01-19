-- Create shipping settings table for configurable shipping costs
CREATE TABLE public.shipping_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text UNIQUE NOT NULL,
  setting_value numeric NOT NULL,
  description_ar text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shipping_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (admins check is done in frontend)
CREATE POLICY "Public can read shipping settings" 
  ON public.shipping_settings 
  FOR SELECT 
  USING (true);

-- Create policy for authenticated users to update (admin check is done in frontend)
CREATE POLICY "Authenticated can update shipping settings" 
  ON public.shipping_settings 
  FOR UPDATE 
  USING (auth.uid() IS NOT NULL);

-- Insert default shipping settings
INSERT INTO public.shipping_settings (setting_key, setting_value, description_ar) VALUES
  ('sea_cbm_price', 350000, 'سعر المتر المكعب للشحن البحري (دينار عراقي)'),
  ('sea_padding_cm', 5, 'الهامش الإضافي للأبعاد (سم)'),
  ('air_usa_kg_price', 30000, 'سعر الكيلو للشحن الجوي من أمريكا (دينار عراقي)'),
  ('air_usa_weight_buffer_percent', 20, 'نسبة الزيادة على الوزن للتغليف (%)'),
  ('air_china_volumetric_price', 15000, 'سعر الوزن الحجمي للشحن الجوي من الصين (دينار عراقي)'),
  ('air_china_volumetric_divider', 5000, 'المقسم للوزن الحجمي من الصين'),
  ('commission_fee', 1000, 'عمولة الخدمة (دينار عراقي)'),
  ('local_delivery_baghdad', 6000, 'تكلفة التوصيل داخل بغداد (دينار عراقي)'),
  ('local_delivery_provinces', 5000, 'تكلفة التوصيل للمحافظات (دينار عراقي)');

-- Add new columns to custom_product_requests for country and shipping info
ALTER TABLE public.custom_product_requests
  ADD COLUMN IF NOT EXISTS source_country text DEFAULT 'china',
  ADD COLUMN IF NOT EXISTS shipping_type text DEFAULT 'sea',
  ADD COLUMN IF NOT EXISTS product_dimensions jsonb,
  ADD COLUMN IF NOT EXISTS product_weight numeric,
  ADD COLUMN IF NOT EXISTS estimated_shipping_cost numeric,
  ADD COLUMN IF NOT EXISTS shipping_notes text;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_shipping_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_shipping_settings_updated_at
  BEFORE UPDATE ON public.shipping_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_shipping_settings_updated_at();