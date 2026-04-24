ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS short_summary jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS searchable_attributes text[] DEFAULT ARRAY[]::text[];

COMMENT ON COLUMN public.products.short_summary IS 'One-line product pitch per language: { ar, en, ku }. Used for meta description & AI summaries.';
COMMENT ON COLUMN public.products.searchable_attributes IS 'Flat list of keyword tags (use case, material, audience, brand, color, etc.) for SEO/AI matching.';

CREATE INDEX IF NOT EXISTS idx_products_searchable_attrs
  ON public.products USING GIN (searchable_attributes);