
-- 1. Drop the permissive "true" SELECT policy on public.messages
DROP POLICY IF EXISTS "Authenticated can receive broadcasts" ON public.messages;

-- 2. Drop the permissive "true" SELECT policy on realtime.messages
DROP POLICY IF EXISTS "Authenticated can receive broadcasts" ON realtime.messages;

-- 3. Lock down internal email queue functions: revoke from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, PUBLIC;

-- 4. Pin search_path for those SECURITY DEFINER functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
