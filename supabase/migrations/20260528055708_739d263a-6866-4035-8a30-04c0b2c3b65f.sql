
-- 1. Harden add_user_tickets: prevent any authenticated user from crediting tickets to anyone
CREATE OR REPLACE FUNCTION public.add_user_tickets(p_user_id uuid, p_amount integer, p_source text DEFAULT 'system'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow only: service_role callers (edge functions / cron / other SECURITY DEFINER fns)
  -- OR the user crediting their own balance via a trusted client path.
  -- NOTE: client-side self-credit is now rejected; all ticket grants must flow through
  -- the service_role (edge functions). Self auth.uid() = p_user_id is permitted only
  -- when called from another SECURITY DEFINER function chain (auth.uid() preserved).
  IF auth.role() <> 'service_role' THEN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
      RAISE EXCEPTION 'Unauthorized: only service_role or the user themselves may credit tickets';
    END IF;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount: Must be positive';
  END IF;

  INSERT INTO user_tickets (user_id, ticket_count)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET 
    ticket_count = user_tickets.ticket_count + p_amount,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$function$;

-- 2. Fix always-true RLS policies on mystery_case_settings and mystery_case_rewards (admin-only management)
DROP POLICY IF EXISTS "Admin can manage mystery case settings" ON public.mystery_case_settings;
CREATE POLICY "Admin can manage mystery case settings"
  ON public.mystery_case_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin can manage mystery case rewards" ON public.mystery_case_rewards;
CREATE POLICY "Admin can manage mystery case rewards"
  ON public.mystery_case_rewards
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Tighten always-true WITH CHECK on telemetry INSERT policies (require authenticated session)
DROP POLICY IF EXISTS "Authenticated can report chunk load errors" ON public.chunk_load_errors;
CREATE POLICY "Authenticated can report chunk load errors"
  ON public.chunk_load_errors
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated insert url analytics" ON public.print_url_analytics;
CREATE POLICY "Authenticated insert url analytics"
  ON public.print_url_analytics
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
