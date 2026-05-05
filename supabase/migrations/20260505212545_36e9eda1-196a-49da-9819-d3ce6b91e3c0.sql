
CREATE TABLE IF NOT EXISTS public.client_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  context text NOT NULL,
  error_code text,
  error_message text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_error_logs_created_at
  ON public.client_error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_error_logs_context
  ON public.client_error_logs (context, created_at DESC);

ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all client error logs" ON public.client_error_logs;
CREATE POLICY "Admins can view all client error logs"
  ON public.client_error_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- No direct INSERT policy: writes go through SECURITY DEFINER function only.

CREATE OR REPLACE FUNCTION public.log_order_error(
  p_context text,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.client_error_logs (user_id, context, error_code, error_message, details)
  VALUES (auth.uid(), p_context, p_error_code, left(coalesce(p_error_message, ''), 2000), p_details)
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL; -- Never let logging break the caller
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_order_error(text, text, text, jsonb) TO authenticated, anon;
