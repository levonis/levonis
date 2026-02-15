
-- Create merchant store categories table
CREATE TABLE public.merchant_store_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL,
  name_ar TEXT NOT NULL,
  image_url TEXT,
  parent_id UUID REFERENCES public.merchant_store_categories(id) ON DELETE CASCADE,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add display layout preference to merchant_applications
ALTER TABLE public.merchant_applications ADD COLUMN IF NOT EXISTS store_layout TEXT NOT NULL DEFAULT 'standard';

-- Enable RLS
ALTER TABLE public.merchant_store_categories ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view active categories"
ON public.merchant_store_categories
FOR SELECT
USING (is_active = true);

-- Merchant can manage their own categories
CREATE POLICY "Merchants can insert their own categories"
ON public.merchant_store_categories
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.merchant_applications
    WHERE id = merchant_id AND user_id = auth.uid() AND status = 'approved'
  )
);

CREATE POLICY "Merchants can update their own categories"
ON public.merchant_store_categories
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.merchant_applications
    WHERE id = merchant_id AND user_id = auth.uid() AND status = 'approved'
  )
);

CREATE POLICY "Merchants can delete their own categories"
ON public.merchant_store_categories
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.merchant_applications
    WHERE id = merchant_id AND user_id = auth.uid() AND status = 'approved'
  )
);

-- Admin full access
CREATE POLICY "Admins can manage all categories"
ON public.merchant_store_categories
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update timestamp trigger
CREATE TRIGGER update_merchant_store_categories_updated_at
BEFORE UPDATE ON public.merchant_store_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
