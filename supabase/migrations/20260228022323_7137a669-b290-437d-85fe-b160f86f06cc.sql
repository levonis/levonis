
-- Fix security definer view by setting security_invoker
ALTER VIEW public.merchant_rating_stats SET (security_invoker = on);
