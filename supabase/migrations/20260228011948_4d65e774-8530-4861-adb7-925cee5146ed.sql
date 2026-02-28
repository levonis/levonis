
-- Table for governorate delivery price exceptions
CREATE TABLE public.delivery_governorate_exceptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  governorate TEXT NOT NULL,
  delivery_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(governorate)
);

-- Table for category-specific delivery price exceptions
CREATE TABLE public.delivery_category_exceptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  delivery_price NUMERIC NOT NULL DEFAULT 0,
  governorate TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, governorate)
);

-- Enable RLS
ALTER TABLE public.delivery_governorate_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_category_exceptions ENABLE ROW LEVEL SECURITY;

-- Admin-only policies (read for all authenticated, write for admin via service role)
CREATE POLICY "Anyone can read governorate exceptions" ON public.delivery_governorate_exceptions FOR SELECT USING (true);
CREATE POLICY "Anyone can read category exceptions" ON public.delivery_category_exceptions FOR SELECT USING (true);

-- Allow admin to manage via service role or check user_roles
CREATE POLICY "Admins can manage governorate exceptions" ON public.delivery_governorate_exceptions 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage category exceptions" ON public.delivery_category_exceptions 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
