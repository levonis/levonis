
-- Add fulfilled status support and reward tracking to wishes
ALTER TABLE public.wishes 
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reward_gift_description TEXT,
  ADD COLUMN IF NOT EXISTS reward_discount_percent NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_free_shipping BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reward_bonus_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rewards_claimed BOOLEAN DEFAULT false;

-- Create unique index on normalized title to prevent duplicate wishes
CREATE UNIQUE INDEX IF NOT EXISTS wishes_unique_title_idx ON public.wishes (LOWER(TRIM(title))) WHERE status != 'rejected';
