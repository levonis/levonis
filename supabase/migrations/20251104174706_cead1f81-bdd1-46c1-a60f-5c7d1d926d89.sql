-- Create main sections table
CREATE TABLE IF NOT EXISTS public.main_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add main_section_id to categories table
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS main_section_id UUID REFERENCES public.main_sections(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.main_sections ENABLE ROW LEVEL SECURITY;

-- Anyone can view main sections
CREATE POLICY "Anyone can view main sections"
ON public.main_sections
FOR SELECT
USING (true);

-- Only admins can manage main sections
CREATE POLICY "Only admins can manage main sections"
ON public.main_sections
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_main_sections_updated_at
BEFORE UPDATE ON public.main_sections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default main sections
INSERT INTO public.main_sections (name, name_ar, display_order)
VALUES 
  ('Computer Parts', 'قطع الكمبيوتر', 1),
  ('Materials', 'المواد', 2),
  ('Other Categories', 'أقسام أخرى', 3)
ON CONFLICT DO NOTHING;