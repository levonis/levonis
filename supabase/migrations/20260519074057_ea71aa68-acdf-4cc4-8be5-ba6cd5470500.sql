
-- 1) Extend community_print_requests with quote-from-link metadata (all nullable, non-breaking)
ALTER TABLE public.community_print_requests
  ADD COLUMN IF NOT EXISTS quote_source text,
  ADD COLUMN IF NOT EXISTS quote_url text,
  ADD COLUMN IF NOT EXISTS estimated_weight_g numeric,
  ADD COLUMN IF NOT EXISTS estimated_print_minutes integer,
  ADD COLUMN IF NOT EXISTS difficulty text,
  ADD COLUMN IF NOT EXISTS estimated_price_min integer,
  ADD COLUMN IF NOT EXISTS estimated_price_max integer,
  ADD COLUMN IF NOT EXISTS quote_breakdown jsonb;

-- Validation trigger (no CHECK with NOT IN to keep flexibility)
CREATE OR REPLACE FUNCTION public.validate_print_request_quote_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.quote_source IS NOT NULL AND NEW.quote_source NOT IN ('url_quote','file_quote') THEN
    RAISE EXCEPTION 'invalid quote_source: %', NEW.quote_source;
  END IF;
  IF NEW.difficulty IS NOT NULL AND NEW.difficulty NOT IN ('easy','medium','hard') THEN
    RAISE EXCEPTION 'invalid difficulty: %', NEW.difficulty;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_print_request_quote_fields ON public.community_print_requests;
CREATE TRIGGER trg_validate_print_request_quote_fields
BEFORE INSERT OR UPDATE ON public.community_print_requests
FOR EACH ROW EXECUTE FUNCTION public.validate_print_request_quote_fields();

CREATE INDEX IF NOT EXISTS idx_community_print_requests_quote_source
  ON public.community_print_requests (quote_source);

-- 2) Quote cache
CREATE TABLE IF NOT EXISTS public.print_quote_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  source text NOT NULL DEFAULT 'scrape',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

ALTER TABLE public.print_quote_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read quote cache" ON public.print_quote_cache;
CREATE POLICY "Authenticated can read quote cache"
ON public.print_quote_cache FOR SELECT
TO authenticated
USING (true);

-- No insert/update/delete policies => only service_role (bypasses RLS) can write.

-- 3) Seed quote_pricing settings
INSERT INTO public.community_settings (key, value, description)
VALUES (
  'quote_pricing',
  jsonb_build_object(
    'filament_price_per_kg', 25000,
    'hourly_machine_cost', 2000,
    'base_complexity_fee', 1500,
    'platform_fee_pct', 0.017,
    'profit_margin_pct', 0.15,
    'min_range_pct', 0.90,
    'max_range_pct', 1.15
  ),
  'Pricing inputs for Instant Quote from Link (IQD).'
)
ON CONFLICT (key) DO NOTHING;
