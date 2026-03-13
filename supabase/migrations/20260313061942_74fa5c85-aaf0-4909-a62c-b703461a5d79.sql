
CREATE TABLE public.game_store_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  reward_type TEXT NOT NULL DEFAULT 'tickets', -- 'tickets' or 'custom'
  reward_value INTEGER NOT NULL DEFAULT 0, -- e.g. number of tickets
  points_cost INTEGER NOT NULL DEFAULT 100,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_purchases INTEGER, -- null = unlimited
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.game_store_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active rewards" ON public.game_store_rewards
  FOR SELECT USING (is_active = true);

CREATE TABLE public.game_store_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.game_store_rewards(id) ON DELETE CASCADE,
  points_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.game_store_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases" ON public.game_store_purchases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchases" ON public.game_store_purchases
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
