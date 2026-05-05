-- Make product_offers_public view bypass caller RLS so anyone can see active offers
ALTER VIEW public.product_offers_public SET (security_invoker = false);
GRANT SELECT ON public.product_offers_public TO anon, authenticated;