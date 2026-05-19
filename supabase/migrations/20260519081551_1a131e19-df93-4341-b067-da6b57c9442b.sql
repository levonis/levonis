
-- 1) Extend print_quote_cache with platform/engine/confidence
ALTER TABLE public.print_quote_cache
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS extraction_engine text,
  ADD COLUMN IF NOT EXISTS confidence_level text;

CREATE INDEX IF NOT EXISTS idx_print_quote_cache_platform_created
  ON public.print_quote_cache(platform, created_at DESC);

-- 2) Analytics table
CREATE TABLE IF NOT EXISTS public.print_url_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url_hash text,
  source_url text NOT NULL,
  platform text,
  user_id uuid,
  engine_used text,
  confidence_level text,
  cache_hit boolean NOT NULL DEFAULT false,
  duration_ms integer,
  converted_to_request boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_print_url_analytics_platform_created
  ON public.print_url_analytics(platform, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_url_analytics_url_hash_created
  ON public.print_url_analytics(url_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_url_analytics_user
  ON public.print_url_analytics(user_id, created_at DESC);

ALTER TABLE public.print_url_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated insert url analytics" ON public.print_url_analytics;
CREATE POLICY "Authenticated insert url analytics"
  ON public.print_url_analytics FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins read url analytics" ON public.print_url_analytics;
CREATE POLICY "Admins read url analytics"
  ON public.print_url_analytics FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Aggregation RPC for the admin dashboard
CREATE OR REPLACE FUNCTION public.get_url_analytics_summary(
  _days integer DEFAULT 30,
  _platform text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total integer;
  _cache_hits integer;
  _avg_ms numeric;
  _conversions integer;
  _by_platform jsonb;
  _top_models jsonb;
  _by_day jsonb;
  _by_confidence jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE cache_hit), avg(duration_ms),
         count(*) FILTER (WHERE converted_to_request)
    INTO _total, _cache_hits, _avg_ms, _conversions
  FROM public.print_url_analytics
  WHERE created_at >= now() - (_days || ' days')::interval
    AND (_platform IS NULL OR platform = _platform);

  SELECT jsonb_agg(jsonb_build_object('platform', coalesce(platform,'other'), 'count', cnt) ORDER BY cnt DESC)
    INTO _by_platform
  FROM (
    SELECT platform, count(*) AS cnt
    FROM public.print_url_analytics
    WHERE created_at >= now() - (_days || ' days')::interval
      AND (_platform IS NULL OR platform = _platform)
    GROUP BY platform
  ) p;

  SELECT jsonb_agg(jsonb_build_object('confidence', coalesce(confidence_level,'unknown'), 'count', cnt) ORDER BY cnt DESC)
    INTO _by_confidence
  FROM (
    SELECT confidence_level, count(*) AS cnt
    FROM public.print_url_analytics
    WHERE created_at >= now() - (_days || ' days')::interval
      AND (_platform IS NULL OR platform = _platform)
    GROUP BY confidence_level
  ) c;

  SELECT jsonb_agg(jsonb_build_object(
           'url_hash', url_hash,
           'source_url', source_url,
           'platform', platform,
           'count', cnt,
           'last_seen', last_seen
         ) ORDER BY cnt DESC)
    INTO _top_models
  FROM (
    SELECT url_hash, max(source_url) AS source_url, max(platform) AS platform,
           count(*) AS cnt, max(created_at) AS last_seen
    FROM public.print_url_analytics
    WHERE created_at >= now() - (_days || ' days')::interval
      AND url_hash IS NOT NULL
      AND (_platform IS NULL OR platform = _platform)
    GROUP BY url_hash
    ORDER BY cnt DESC
    LIMIT 20
  ) t;

  SELECT jsonb_agg(jsonb_build_object('day', day, 'count', cnt) ORDER BY day)
    INTO _by_day
  FROM (
    SELECT date_trunc('day', created_at)::date AS day, count(*) AS cnt
    FROM public.print_url_analytics
    WHERE created_at >= now() - (_days || ' days')::interval
      AND (_platform IS NULL OR platform = _platform)
    GROUP BY 1
  ) d;

  RETURN jsonb_build_object(
    'total', coalesce(_total, 0),
    'cache_hits', coalesce(_cache_hits, 0),
    'cache_hit_rate', CASE WHEN coalesce(_total,0) > 0 THEN round((_cache_hits::numeric / _total) * 100, 1) ELSE 0 END,
    'avg_duration_ms', coalesce(round(_avg_ms), 0),
    'conversions', coalesce(_conversions, 0),
    'conversion_rate', CASE WHEN coalesce(_total,0) > 0 THEN round((_conversions::numeric / _total) * 100, 1) ELSE 0 END,
    'by_platform', coalesce(_by_platform, '[]'::jsonb),
    'by_confidence', coalesce(_by_confidence, '[]'::jsonb),
    'top_models', coalesce(_top_models, '[]'::jsonb),
    'by_day', coalesce(_by_day, '[]'::jsonb)
  );
END;
$$;

-- 4) Mark a recent analytics row as converted to a print request
CREATE OR REPLACE FUNCTION public.mark_url_analytics_converted(_url_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR _url_hash IS NULL THEN RETURN; END IF;
  UPDATE public.print_url_analytics
     SET converted_to_request = true
   WHERE id = (
     SELECT id FROM public.print_url_analytics
      WHERE user_id = auth.uid() AND url_hash = _url_hash
      ORDER BY created_at DESC
      LIMIT 1
   );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_url_analytics_summary(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_url_analytics_converted(text) TO authenticated;
