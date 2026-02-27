
-- Create price match requests table
CREATE TABLE public.price_match_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  found_price NUMERIC NOT NULL,
  image_url TEXT,
  source_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.price_match_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own requests
CREATE POLICY "Users can create price match requests"
ON public.price_match_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own requests
CREATE POLICY "Users can view own price match requests"
ON public.price_match_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all price match requests"
ON public.price_match_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update requests
CREATE POLICY "Admins can update price match requests"
ON public.price_match_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_price_match_requests_updated_at
BEFORE UPDATE ON public.price_match_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
