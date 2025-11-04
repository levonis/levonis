-- Create product_options table for product variants
CREATE TABLE public.product_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  price_adjustment NUMERIC DEFAULT 0,
  in_stock BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view product options"
ON public.product_options
FOR SELECT
USING (true);

CREATE POLICY "Only admins can manage product options"
ON public.product_options
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create index for better performance
CREATE INDEX idx_product_options_product_id ON public.product_options(product_id);