
-- Allow admins to manage game store rewards (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can insert rewards"
ON public.game_store_rewards
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update rewards"
ON public.game_store_rewards
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete rewards"
ON public.game_store_rewards
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Also allow admins to view all rewards (not just active ones)
CREATE POLICY "Admins can view all rewards"
ON public.game_store_rewards
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
