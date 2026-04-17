-- Fast aggregate: returns category IDs that have at least one in-stock direct-sale product
-- Reduces client-side filtering load by computing on the database
CREATE OR REPLACE FUNCTION public.get_direct_sale_category_ids()
RETURNS TABLE(category_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.category_id
  FROM public.products p
  WHERE p.has_in_stock = true
    AND p.is_pricing_updated = true
    AND p.category_id IS NOT NULL
    AND (
      -- Has positive direct stock at product level
      COALESCE((p.direct_stock)::int, 0) > 0
      OR
      -- Or any color variant has positive stock
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(p.colors::jsonb, '[]'::jsonb)) AS c
        WHERE COALESCE((c->>'direct_stock')::int, 0) > 0
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_direct_sale_category_ids() TO anon, authenticated;