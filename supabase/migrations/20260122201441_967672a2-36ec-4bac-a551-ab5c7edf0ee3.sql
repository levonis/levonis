-- Create merchant_ratings table
CREATE TABLE IF NOT EXISTS public.merchant_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchant_applications(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  request_id UUID NOT NULL REFERENCES public.print_requests(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure a customer can only rate a merchant once per completed request
  UNIQUE(merchant_id, customer_id, request_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_merchant_ratings_merchant_id ON public.merchant_ratings(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_ratings_customer_id ON public.merchant_ratings(customer_id);
CREATE INDEX IF NOT EXISTS idx_merchant_ratings_request_id ON public.merchant_ratings(request_id);

-- Enable RLS
ALTER TABLE public.merchant_ratings ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view ratings
CREATE POLICY "Anyone can view merchant ratings"
ON public.merchant_ratings
FOR SELECT
USING (true);

-- Policy: Customers can insert ratings only for completed requests where they are the customer
CREATE POLICY "Customers can rate completed requests"
ON public.merchant_ratings
FOR INSERT
WITH CHECK (
  auth.uid() = customer_id
  AND EXISTS (
    SELECT 1 FROM public.print_requests pr
    INNER JOIN public.print_offers po ON pr.accepted_offer_id = po.id
    WHERE pr.id = request_id
      AND pr.user_id = auth.uid()
      AND pr.status = 'delivered'
      AND po.trader_id IN (
        SELECT user_id FROM public.merchant_applications WHERE id = merchant_id
      )
  )
);

-- Policy: Customers can update their own ratings
CREATE POLICY "Customers can update their own ratings"
ON public.merchant_ratings
FOR UPDATE
USING (auth.uid() = customer_id);

-- Policy: Customers can delete their own ratings
CREATE POLICY "Customers can delete their own ratings"
ON public.merchant_ratings
FOR DELETE
USING (auth.uid() = customer_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_merchant_ratings_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_merchant_ratings_updated_at
BEFORE UPDATE ON public.merchant_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_merchant_ratings_updated_at_column();

-- Create view for merchant rating stats
CREATE OR REPLACE VIEW public.merchant_rating_stats AS
SELECT
  merchant_id,
  COUNT(*) as total_ratings,
  AVG(rating)::numeric(3,2) as average_rating,
  COUNT(CASE WHEN rating = 5 THEN 1 END) as five_stars,
  COUNT(CASE WHEN rating = 4 THEN 1 END) as four_stars,
  COUNT(CASE WHEN rating = 3 THEN 1 END) as three_stars,
  COUNT(CASE WHEN rating = 2 THEN 1 END) as two_stars,
  COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
FROM public.merchant_ratings
GROUP BY merchant_id;