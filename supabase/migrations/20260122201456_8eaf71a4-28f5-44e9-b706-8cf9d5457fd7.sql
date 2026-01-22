-- Fix security issue: Recreate view with SECURITY INVOKER
DROP VIEW IF EXISTS public.merchant_rating_stats;

CREATE OR REPLACE VIEW public.merchant_rating_stats
WITH (security_invoker = true)
AS
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