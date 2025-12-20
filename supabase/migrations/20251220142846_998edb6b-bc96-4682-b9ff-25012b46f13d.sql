-- Fix competition_tickets: Remove public access, keep only authenticated access
DROP POLICY IF EXISTS "Anyone can view tickets for public competitions" ON public.competition_tickets;
DROP POLICY IF EXISTS "Admins can manage tickets" ON public.competition_tickets;
DROP POLICY IF EXISTS "Users can purchase tickets" ON public.competition_tickets;
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.competition_tickets;

CREATE POLICY "Admins can manage tickets"
ON public.competition_tickets
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own tickets"
ON public.competition_tickets
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can purchase tickets"
ON public.competition_tickets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Fix default_settings: Only authenticated users can view settings
DROP POLICY IF EXISTS "Anyone can view default settings" ON public.default_settings;
DROP POLICY IF EXISTS "Only admins can manage default settings" ON public.default_settings;

CREATE POLICY "Authenticated users can view default settings"
ON public.default_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can manage default settings"
ON public.default_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));