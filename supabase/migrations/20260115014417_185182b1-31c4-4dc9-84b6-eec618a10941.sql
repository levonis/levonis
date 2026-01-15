
-- Fix the permissive RLS policy for logs
DROP POLICY IF EXISTS "System can insert logs" ON public.printer_protection_logs;

-- Create a more secure policy - only authenticated users can insert their own logs
CREATE POLICY "Authenticated users can insert logs" ON public.printer_protection_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR user_id IS NULL));
