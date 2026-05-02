
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY product_id, COALESCE(name_ar,''), COALESCE(name,''), COALESCE(price_adjustment,0)
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.product_options
  WHERE product_id = '691995e6-fe5a-4fbd-8892-7fc8ccaf44fb'
)
DELETE FROM public.product_options
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
