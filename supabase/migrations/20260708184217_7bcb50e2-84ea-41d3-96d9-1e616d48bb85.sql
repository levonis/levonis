
-- 1. Remove client-side INSERT for card_discount_usage; only SECURITY DEFINER RPCs (service_role) may insert
DROP POLICY IF EXISTS "System can insert discount usage" ON public.card_discount_usage;

-- 2. Remove client-side INSERT for gacha_spins
DROP POLICY IF EXISTS "System inserts spins" ON public.gacha_spins;

-- 3. Remove client-side INSERT for gacha_transactions
DROP POLICY IF EXISTS "System inserts transactions" ON public.gacha_transactions;

-- 4. Remove client-side INSERT for milestone/level prize claim tables
DROP POLICY IF EXISTS "Users can insert own knife_rain_milestone_claims" ON public.knife_rain_milestone_claims;
DROP POLICY IF EXISTS "Users can insert own crossy milestone claims" ON public.crossy_road_milestone_claims;
DROP POLICY IF EXISTS "Users can claim milestones" ON public.stack_game_milestone_claims;
DROP POLICY IF EXISTS "System inserts level claims" ON public.user_level_prize_claims;

-- 5. community_customer_profiles: restrict SELECT to owner + admin/assistant.
--    Public consumers must use the community_customer_profiles_public view instead.
DROP POLICY IF EXISTS "Anyone can view customer profiles" ON public.community_customer_profiles;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_customer_profiles'
      AND policyname = 'Owner or admin can view customer profile'
  ) THEN
    CREATE POLICY "Owner or admin can view customer profile"
      ON public.community_customer_profiles
      FOR SELECT TO authenticated
      USING (
        auth.uid() = user_id
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'assistant'::app_role)
      );
  END IF;
END $$;
