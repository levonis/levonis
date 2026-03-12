
-- Mystery Case game settings
CREATE TABLE public.mystery_case_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tickets_per_spin integer NOT NULL DEFAULT 4,
  game_enabled boolean NOT NULL DEFAULT true,
  spin_cooldown_seconds integer NOT NULL DEFAULT 0,
  spin_sound_enabled boolean NOT NULL DEFAULT true,
  reel_speed numeric NOT NULL DEFAULT 1.0,
  animation_duration_ms integer NOT NULL DEFAULT 5000,
  pixel_theme boolean NOT NULL DEFAULT true,
  daily_free_spin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.mystery_case_settings (id) VALUES (gen_random_uuid());

-- Mystery Case rewards
CREATE TABLE public.mystery_case_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_type text NOT NULL DEFAULT 'custom',
  name_ar text NOT NULL,
  description_ar text,
  image_url text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ticket_reward_amount integer DEFAULT 0,
  rarity text NOT NULL DEFAULT 'common',
  drop_chance numeric NOT NULL DEFAULT 10.0,
  display_only boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Mystery Case spin history
CREATE TABLE public.mystery_case_spins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reward_id uuid REFERENCES public.mystery_case_rewards(id) ON DELETE SET NULL,
  reward_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  tickets_spent integer NOT NULL DEFAULT 0,
  is_claimed boolean NOT NULL DEFAULT false,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mystery_case_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mystery_case_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mystery_case_spins ENABLE ROW LEVEL SECURITY;

-- Settings: anyone can read, only admin (via edge function) writes
CREATE POLICY "Anyone can read mystery case settings"
  ON public.mystery_case_settings FOR SELECT
  TO authenticated USING (true);

-- Rewards: anyone can read active rewards
CREATE POLICY "Anyone can read active mystery case rewards"
  ON public.mystery_case_rewards FOR SELECT
  TO authenticated USING (true);

-- Spins: users can read own spins
CREATE POLICY "Users can read own spins"
  ON public.mystery_case_spins FOR SELECT
  TO authenticated USING (user_id = auth.uid());

-- Spins: insert via service role only (edge function)
CREATE POLICY "Service role inserts spins"
  ON public.mystery_case_spins FOR INSERT
  TO service_role WITH CHECK (true);

-- Allow anon read for settings (game page)
CREATE POLICY "Anon can read mystery case settings"
  ON public.mystery_case_settings FOR SELECT
  TO anon USING (true);

CREATE POLICY "Anon can read mystery case rewards"
  ON public.mystery_case_rewards FOR SELECT
  TO anon USING (true);
