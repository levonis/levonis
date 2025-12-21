-- Add new competition types to the enum
ALTER TYPE public.competition_type ADD VALUE IF NOT EXISTS 'instant_winner';
ALTER TYPE public.competition_type ADD VALUE IF NOT EXISTS 'everyone_wins';
ALTER TYPE public.competition_type ADD VALUE IF NOT EXISTS 'escalating_price';
ALTER TYPE public.competition_type ADD VALUE IF NOT EXISTS 'mystery_box';
ALTER TYPE public.competition_type ADD VALUE IF NOT EXISTS 'hidden_winner';
ALTER TYPE public.competition_type ADD VALUE IF NOT EXISTS 'team_battle';
ALTER TYPE public.competition_type ADD VALUE IF NOT EXISTS 'flash_sale';
ALTER TYPE public.competition_type ADD VALUE IF NOT EXISTS 'growing_prize';

-- Add new columns to competitions table for extended functionality
ALTER TABLE public.competitions 
ADD COLUMN IF NOT EXISTS prize_tiers jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS price_tiers jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS mystery_boxes jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS hidden_winner_ticket_id uuid,
ADD COLUMN IF NOT EXISTS team_config jsonb DEFAULT '{"team_a": [], "team_b": []}'::jsonb,
ADD COLUMN IF NOT EXISTS is_flash boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS flash_badge_text text,
ADD COLUMN IF NOT EXISTS growing_prize_config jsonb DEFAULT '{"base_prize": 0, "increment_per_interval": 0, "interval_minutes": 60}'::jsonb,
ADD COLUMN IF NOT EXISTS instant_reveal boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS remaining_prizes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS theme_color text DEFAULT '#d4af37';

-- Add column for tracking instant winners
ALTER TABLE public.competition_tickets 
ADD COLUMN IF NOT EXISTS prize_tier_id text,
ADD COLUMN IF NOT EXISTS prize_won jsonb,
ADD COLUMN IF NOT EXISTS revealed_at timestamptz;

COMMENT ON COLUMN public.competitions.prize_tiers IS 'For everyone_wins/mystery_box: [{id, name_ar, probability, quantity, remaining, image_url}]';
COMMENT ON COLUMN public.competitions.price_tiers IS 'For escalating_price: [{min_sold, max_sold, price}]';
COMMENT ON COLUMN public.competitions.mystery_boxes IS 'For mystery_box: [{id, name_ar, image_url, prize_tier_ids}]';
COMMENT ON COLUMN public.competitions.team_config IS 'For team_battle: {team_a: {name, color, tickets[]}, team_b: {name, color, tickets[]}}';
COMMENT ON COLUMN public.competitions.growing_prize_config IS 'For growing_prize: {base_prize, increment, interval_minutes, max_prize}';