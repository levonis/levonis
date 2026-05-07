
CREATE TABLE IF NOT EXISTS public.web_vitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  metric_name text NOT NULL,
  metric_value double precision NOT NULL,
  metric_rating text,
  metric_id text,
  navigation_type text,
  path text,
  user_agent text,
  viewport_width integer,
  device_pixel_ratio double precision,
  connection_type text,
  user_id uuid
);

CREATE INDEX IF NOT EXISTS idx_web_vitals_created_at ON public.web_vitals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_vitals_metric_name ON public.web_vitals (metric_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_vitals_path ON public.web_vitals (path, created_at DESC);

ALTER TABLE public.web_vitals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert web vitals" ON public.web_vitals;
CREATE POLICY "Anyone can insert web vitals"
  ON public.web_vitals FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read web vitals" ON public.web_vitals;
CREATE POLICY "Admins can read web vitals"
  ON public.web_vitals FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
