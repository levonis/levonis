-- Create delivery methods table
CREATE TABLE public.delivery_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  method_key TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  description_ar TEXT,
  base_price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  icon TEXT DEFAULT 'package',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_methods ENABLE ROW LEVEL SECURITY;

-- Everyone can read delivery methods
CREATE POLICY "Anyone can view delivery methods"
ON public.delivery_methods FOR SELECT
USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage delivery methods"
ON public.delivery_methods FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default delivery methods
INSERT INTO public.delivery_methods (method_key, name_ar, description_ar, base_price, display_order, icon) VALUES
  ('pickup', 'الاستلام من المخزن', 'استلم طلبك مباشرة من مخزننا - مجاناً', 0, 1, 'warehouse'),
  ('standard', 'التوصيل الاعتيادي', 'توصيل عبر شركات الشحن المحلية', 5000, 2, 'truck'),
  ('personal', 'التوصيل الشخصي', 'توصيل شخصي مباشر لباب منزلك', 10000, 3, 'user');

-- Add delivery_method_key to existing exception tables
ALTER TABLE public.delivery_governorate_exceptions
ADD COLUMN delivery_method_key TEXT NOT NULL DEFAULT 'standard';

ALTER TABLE public.delivery_category_exceptions
ADD COLUMN delivery_method_key TEXT NOT NULL DEFAULT 'standard';

-- Add delivery_method to orders table
ALTER TABLE public.orders
ADD COLUMN delivery_method TEXT DEFAULT 'standard';