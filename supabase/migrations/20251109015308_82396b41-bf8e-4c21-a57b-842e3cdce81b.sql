-- Create default_settings table for storing default product settings
CREATE TABLE public.default_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.default_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can view default settings
CREATE POLICY "Anyone can view default settings"
ON public.default_settings
FOR SELECT
USING (true);

-- Only admins can manage default settings
CREATE POLICY "Only admins can manage default settings"
ON public.default_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_default_settings_updated_at
BEFORE UPDATE ON public.default_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial default settings for products
INSERT INTO public.default_settings (setting_key, setting_value) VALUES
('product_defaults', '{
  "has_in_stock": false,
  "has_pre_order": true,
  "availability_type": "pre_order",
  "pre_order_shipping_options": [
    {
      "name": "Free Shipping (45 days)",
      "name_ar": "شحن مجاني (45 يومًا)",
      "price_adjustment": 0
    }
  ],
  "currency": "ريال",
  "featured": false,
  "in_stock": true
}'::jsonb);