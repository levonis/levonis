
-- Create table to store merchant guide images per section
CREATE TABLE public.merchant_guide_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_key TEXT NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_guide_images ENABLE ROW LEVEL SECURITY;

-- Everyone can read guide images
CREATE POLICY "Anyone can view merchant guide images"
  ON public.merchant_guide_images
  FOR SELECT
  USING (true);

-- Only admins can manage guide images
CREATE POLICY "Admins can manage merchant guide images"
  ON public.merchant_guide_images
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Create index for fast lookups by section
CREATE INDEX idx_merchant_guide_images_section ON public.merchant_guide_images(section_key, display_order);

-- Insert default section entries so admin knows what sections exist
INSERT INTO public.merchant_guide_images (section_key, image_url, caption, display_order) VALUES
  ('store', '', 'صورة إعدادات المتجر', 0),
  ('products', '', 'صورة إدارة المنتجات', 0),
  ('custom_requests', '', 'صورة طلبات العملاء المخصصة', 0),
  ('orders', '', 'صورة إدارة الطلبات', 0),
  ('messages', '', 'صورة المحادثات', 0),
  ('revenue', '', 'صورة الإيرادات والمحفظة', 0),
  ('ratings', '', 'صورة التقييمات', 0),
  ('delivery', '', 'صورة إعدادات التوصيل', 0),
  ('settings', '', 'صورة الإعدادات المتقدمة', 0);
