-- Restore security_invoker on the public view
ALTER VIEW public.product_offers_public SET (security_invoker = true);

-- Add a public read policy on product_offers limited to active offers
CREATE POLICY "Anyone can view active product offers"
ON public.product_offers
FOR SELECT
TO anon, authenticated
USING (status = 'active');

GRANT SELECT ON public.product_offers_public TO anon, authenticated;
GRANT SELECT ON public.product_offers TO anon, authenticated;