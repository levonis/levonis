-- Create custom product requests table
CREATE TABLE IF NOT EXISTS public.custom_product_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_link TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_product_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view their own custom requests"
ON public.custom_product_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own requests
CREATE POLICY "Users can create custom requests"
ON public.custom_product_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all custom requests"
ON public.custom_product_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update request status
CREATE POLICY "Admins can update custom requests"
ON public.custom_product_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_custom_product_requests_updated_at
BEFORE UPDATE ON public.custom_product_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();