-- Table to log chunk/asset load failures from end-user browsers
CREATE TABLE public.chunk_load_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NULL,
  url TEXT NULL,            -- page URL where error occurred
  asset_url TEXT NULL,      -- the chunk/asset that failed to load
  message TEXT NULL,        -- error message
  error_type TEXT NULL,     -- 'chunk' | 'unhandledrejection' | 'resource' | 'mount-timeout'
  user_agent TEXT NULL,
  platform TEXT NULL,       -- ios/android/desktop/etc.
  is_mobile BOOLEAN NULL,
  network_type TEXT NULL,   -- effectiveType from navigator.connection
  downlink NUMERIC NULL,
  rtt INTEGER NULL,
  save_data BOOLEAN NULL,
  viewport_width INTEGER NULL,
  viewport_height INTEGER NULL,
  language TEXT NULL,
  referrer TEXT NULL,
  recovery_attempts INTEGER NULL,
  ms_since_load INTEGER NULL
);

CREATE INDEX idx_chunk_load_errors_created_at ON public.chunk_load_errors (created_at DESC);
CREATE INDEX idx_chunk_load_errors_type ON public.chunk_load_errors (error_type, created_at DESC);

ALTER TABLE public.chunk_load_errors ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon, since errors happen before auth) can INSERT
CREATE POLICY "Anyone can report chunk load errors"
ON public.chunk_load_errors
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can view chunk load errors"
ON public.chunk_load_errors
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete (for cleanup)
CREATE POLICY "Admins can delete chunk load errors"
ON public.chunk_load_errors
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));