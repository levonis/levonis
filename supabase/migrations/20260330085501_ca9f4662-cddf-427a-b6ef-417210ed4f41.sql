-- Allow admins to read all stack game sessions
CREATE POLICY "Admins can read all sessions"
ON public.stack_game_sessions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));