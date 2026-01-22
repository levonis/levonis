-- Migration B: schema for acceptance + mutual ratings + reputation view
ALTER TABLE public.print_requests
  ADD COLUMN IF NOT EXISTS accepted_offer_id uuid NULL,
  ADD COLUMN IF NOT EXISTS in_progress_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS customer_confirmed_at timestamptz NULL;

ALTER TABLE public.print_offers
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='print_requests_accepted_offer_id_fkey'
  ) THEN
    ALTER TABLE public.print_requests
      ADD CONSTRAINT print_requests_accepted_offer_id_fkey
      FOREIGN KEY (accepted_offer_id) REFERENCES public.print_offers(id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_print_requests_user_id ON public.print_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_print_requests_accepted_offer_id ON public.print_requests(accepted_offer_id);
CREATE INDEX IF NOT EXISTS idx_print_offers_trader_id ON public.print_offers(trader_id);
CREATE INDEX IF NOT EXISTS idx_print_offers_request_id ON public.print_offers(request_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='print_rating_role') THEN
    CREATE TYPE public.print_rating_role AS ENUM ('customer', 'merchant');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.print_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.print_requests(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ratee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rater_role public.print_rating_role NOT NULL,
  stars integer NOT NULL,
  quality_stars integer NULL,
  speed_stars integer NULL,
  comment text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT print_ratings_stars_range CHECK (stars BETWEEN 1 AND 5),
  CONSTRAINT print_ratings_quality_range CHECK (quality_stars IS NULL OR (quality_stars BETWEEN 1 AND 5)),
  CONSTRAINT print_ratings_speed_range CHECK (speed_stars IS NULL OR (speed_stars BETWEEN 1 AND 5))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_print_ratings_request_rater ON public.print_ratings(request_id, rater_id);
CREATE INDEX IF NOT EXISTS idx_print_ratings_ratee_id ON public.print_ratings(ratee_id);
CREATE INDEX IF NOT EXISTS idx_print_ratings_request_id ON public.print_ratings(request_id);

-- updated_at trigger function might already exist; create if missing
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_print_ratings_updated_at') THEN
    CREATE TRIGGER trg_print_ratings_updated_at
    BEFORE UPDATE ON public.print_ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

ALTER TABLE public.print_ratings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='print_ratings' AND policyname='Public can view print ratings') THEN
    CREATE POLICY "Public can view print ratings"
    ON public.print_ratings
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='print_ratings' AND policyname='Users can create their rating') THEN
    CREATE POLICY "Users can create their rating"
    ON public.print_ratings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = rater_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='print_ratings' AND policyname='Users can update their rating') THEN
    CREATE POLICY "Users can update their rating"
    ON public.print_ratings
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = rater_id)
    WITH CHECK (auth.uid() = rater_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='print_ratings' AND policyname='Users can delete their rating') THEN
    CREATE POLICY "Users can delete their rating"
    ON public.print_ratings
    FOR DELETE
    TO authenticated
    USING (auth.uid() = rater_id);
  END IF;
END$$;

CREATE OR REPLACE VIEW public.user_print_reputation AS
WITH reqs AS (
  SELECT
    pr.id,
    pr.user_id AS customer_id,
    po.trader_id AS merchant_id,
    pr.status,
    pr.created_at,
    pr.delivered_at,
    pr.customer_confirmed_at,
    po.accepted_at,
    po.duration_days
  FROM public.print_requests pr
  LEFT JOIN public.print_offers po
    ON po.id = pr.accepted_offer_id
),
customer_kpis AS (
  SELECT
    customer_id AS user_id,
    COUNT(*)::int AS requests_made,
    COUNT(*) FILTER (WHERE status IN ('completed','delivered'))::int AS requests_received,
    CASE WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('completed','delivered')) / COUNT(*), 1)
    END AS receive_rate_percent
  FROM reqs
  WHERE customer_id IS NOT NULL
  GROUP BY customer_id
),
merchant_kpis AS (
  SELECT
    merchant_id AS user_id,
    COUNT(*) FILTER (WHERE status IN ('in_progress','completed','delivered'))::int AS accepted_jobs,
    COUNT(*) FILTER (WHERE status IN ('completed','delivered'))::int AS completed_jobs,
    CASE WHEN COUNT(*) FILTER (WHERE status IN ('in_progress','completed','delivered')) = 0 THEN 0
      ELSE ROUND(
        100.0 * COUNT(*) FILTER (WHERE status IN ('completed','delivered'))
        / NULLIF(COUNT(*) FILTER (WHERE status IN ('in_progress','completed','delivered')),0),
        1
      )
    END AS completion_percent
  FROM reqs
  WHERE merchant_id IS NOT NULL
  GROUP BY merchant_id
),
ratings AS (
  SELECT
    ratee_id AS user_id,
    COUNT(*)::int AS ratings_count,
    ROUND(AVG(stars)::numeric, 2) AS avg_stars,
    ROUND(AVG(quality_stars)::numeric, 2) AS avg_quality_stars,
    ROUND(AVG(speed_stars)::numeric, 2) AS avg_speed_stars
  FROM public.print_ratings
  GROUP BY ratee_id
)
SELECT
  p.id AS user_id,
  COALESCE(r.ratings_count, 0) AS ratings_count,
  COALESCE(r.avg_stars, 0) AS avg_stars,
  COALESCE(r.avg_quality_stars, 0) AS avg_quality_stars,
  COALESCE(r.avg_speed_stars, 0) AS avg_speed_stars,
  COALESCE(ck.requests_made, 0) AS customer_requests_made,
  COALESCE(ck.requests_received, 0) AS customer_requests_received,
  COALESCE(ck.receive_rate_percent, 0) AS customer_receive_rate_percent,
  COALESCE(mk.accepted_jobs, 0) AS merchant_accepted_jobs,
  COALESCE(mk.completed_jobs, 0) AS merchant_completed_jobs,
  COALESCE(mk.completion_percent, 0) AS merchant_completion_percent
FROM public.profiles p
LEFT JOIN ratings r ON r.user_id = p.id
LEFT JOIN customer_kpis ck ON ck.user_id = p.id
LEFT JOIN merchant_kpis mk ON mk.user_id = p.id;

CREATE OR REPLACE FUNCTION public.compute_overall_print_score(
  p_avg_stars numeric,
  p_completion_percent numeric,
  p_receive_rate_percent numeric,
  p_avg_quality_stars numeric,
  p_avg_speed_stars numeric
) RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  base numeric;
  completion_score numeric;
  receive_score numeric;
  quality_score numeric;
  speed_score numeric;
BEGIN
  completion_score := LEAST(5, GREATEST(0, (p_completion_percent / 100.0) * 5));
  receive_score := LEAST(5, GREATEST(0, (p_receive_rate_percent / 100.0) * 5));
  quality_score := COALESCE(p_avg_quality_stars, 0);
  speed_score := COALESCE(p_avg_speed_stars, 0);

  base :=
    (COALESCE(p_avg_stars, 0) * 0.40) +
    (completion_score * 0.25) +
    (receive_score * 0.15) +
    (quality_score * 0.10) +
    (speed_score * 0.10);

  RETURN ROUND(base, 2);
END;
$$;