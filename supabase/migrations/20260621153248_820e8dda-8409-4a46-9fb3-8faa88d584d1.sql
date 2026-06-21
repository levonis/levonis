-- 1) Add shipping_type column to cart_items
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS shipping_type text;

-- 2) Backfill for legacy items where the user picked a shipping option
--    (multi-shipping products). Reconstruct ProductDetail's fallback order
--    (sea → air → land filtered by tokens with a positive price) and map
--    shipping_option_index → token.
WITH expanded AS (
  SELECT
    ci.id AS cart_item_id,
    ci.shipping_option_index AS idx,
    ARRAY(
      SELECT t FROM (
        SELECT 'sea'::text  AS t WHERE position('sea'  in coalesce(p.shipping_type,'')) > 0 AND coalesce(p.sea_price,0)  > 0
        UNION ALL
        SELECT 'air'::text  AS t WHERE position('air'  in coalesce(p.shipping_type,'')) > 0 AND coalesce(p.air_price,0)  > 0
        UNION ALL
        SELECT 'land'::text AS t WHERE position('land' in coalesce(p.shipping_type,'')) > 0 AND coalesce(p.land_price,0) > 0
      ) s
    ) AS ordered_tokens
  FROM public.cart_items ci
  JOIN public.products p ON p.id = ci.product_id
  WHERE (ci.shipping_type IS NULL OR ci.shipping_type = '')
    AND ci.sale_type IS DISTINCT FROM 'direct'
    AND ci.shipping_option_index IS NOT NULL
)
UPDATE public.cart_items ci
SET shipping_type = e.ordered_tokens[e.idx + 1]
FROM expanded e
WHERE ci.id = e.cart_item_id
  AND e.idx >= 0
  AND array_length(e.ordered_tokens, 1) IS NOT NULL
  AND e.idx + 1 <= array_length(e.ordered_tokens, 1);