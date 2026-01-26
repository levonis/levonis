-- Create community categories table for merchants and products
CREATE TABLE public.community_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  icon TEXT DEFAULT 'Package',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.community_categories ENABLE ROW LEVEL SECURITY;

-- Categories are public read
CREATE POLICY "Anyone can view active community categories"
ON public.community_categories
FOR SELECT
USING (is_active = true);

-- Only admins can manage categories (via service role)

-- Add category_ids array to merchant_products
ALTER TABLE public.merchant_products 
ADD COLUMN IF NOT EXISTS category_ids UUID[] DEFAULT '{}';

-- Add category_ids to print_requests for customer requests
ALTER TABLE public.print_requests 
ADD COLUMN IF NOT EXISTS category_ids UUID[] DEFAULT '{}';

-- Insert some default categories
INSERT INTO public.community_categories (name_ar, name_en, icon, display_order) VALUES
('تصميم جرافيك', 'Graphic Design', 'Palette', 1),
('طباعة', 'Printing', 'Printer', 2),
('تسويق رقمي', 'Digital Marketing', 'TrendingUp', 3),
('برمجة وتطوير', 'Development', 'Code', 4),
('كتابة ومحتوى', 'Writing & Content', 'FileText', 5),
('فيديو وتحريك', 'Video & Motion', 'Video', 6),
('خدمات أخرى', 'Other Services', 'MoreHorizontal', 7);

-- Enable realtime for categories
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_categories;