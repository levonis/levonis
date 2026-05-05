CREATE TABLE IF NOT EXISTS public.client_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  source text NOT NULL,
  message text NOT NULL,
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_error_logs_created_at ON public.client_error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_error_logs_source ON public.client_error_logs (source);

ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view client error logs" ON public.client_error_logs;
CREATE POLICY "Admins can view client error logs"
ON public.client_error_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_client_error(
  p_source text,
  p_message text,
  p_context jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.client_error_logs (user_id, source, message, context)
  VALUES (auth.uid(), COALESCE(p_source, 'unknown'), LEFT(COALESCE(p_message, ''), 2000), p_context);
EXCEPTION WHEN OTHERS THEN
  -- Never block clients on logging errors
  NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_client_error(text, text, jsonb) TO anon, authenticated;