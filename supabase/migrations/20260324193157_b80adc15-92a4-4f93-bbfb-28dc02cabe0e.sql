
-- Fix 2: letter_prize_redemptions - Replace broad PERMISSIVE ALL with separate scoped policies
DROP POLICY IF EXISTS "Require authentication for redemptions" ON public.letter_prize_redemptions;

-- Users can only SELECT their own redemptions
DROP POLICY IF EXISTS "Users can view own redemptions" ON public.letter_prize_redemptions;
CREATE POLICY "Users can view own redemptions"
  ON public.letter_prize_redemptions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only INSERT their own redemptions
DROP POLICY IF EXISTS "Users can insert own redemptions" ON public.letter_prize_redemptions;
CREATE POLICY "Users can insert own redemptions"
  ON public.letter_prize_redemptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can do everything
DROP POLICY IF EXISTS "Admins can manage all redemptions" ON public.letter_prize_redemptions;
CREATE POLICY "Admins can manage all redemptions"
  ON public.letter_prize_redemptions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
