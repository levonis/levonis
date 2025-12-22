-- Add new competition type for collect_letters
ALTER TYPE public.competition_type ADD VALUE IF NOT EXISTS 'collect_letters';

-- Add new columns for enhanced competition settings
ALTER TABLE public.competitions
ADD COLUMN IF NOT EXISTS letters_config jsonb DEFAULT '{"letters": [], "prize_words": []}'::jsonb,
ADD COLUMN IF NOT EXISTS win_probability numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hidden_winner_trigger_ticket integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS team_a_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS team_b_count integer DEFAULT 0;

-- Add column to competition_tickets for letters collected
ALTER TABLE public.competition_tickets
ADD COLUMN IF NOT EXISTS letter_awarded text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS team text DEFAULT NULL;

-- Add column to track user collected letters across tickets
CREATE TABLE IF NOT EXISTS public.user_collected_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  letter text NOT NULL,
  ticket_id uuid REFERENCES public.competition_tickets(id) ON DELETE SET NULL,
  collected_at timestamptz DEFAULT now(),
  UNIQUE(ticket_id)
);

-- Enable RLS on user_collected_letters
ALTER TABLE public.user_collected_letters ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_collected_letters
CREATE POLICY "Users can view their own collected letters"
  ON public.user_collected_letters
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Require authentication for collected letters"
  ON public.user_collected_letters
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage collected letters"
  ON public.user_collected_letters
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));