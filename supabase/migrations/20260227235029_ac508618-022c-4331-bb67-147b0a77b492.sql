
-- Create level_prizes table for admin-configured prizes per level
CREATE TABLE public.level_prizes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level_id UUID NOT NULL REFERENCES public.loyalty_levels(id) ON DELETE CASCADE,
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  prize_type TEXT NOT NULL DEFAULT 'points',
  prize_value NUMERIC DEFAULT 0,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.level_prizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active level prizes"
  ON public.level_prizes FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage level prizes"
  ON public.level_prizes FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Drop auto XP trigger (revert to manual card purchase)
DROP TRIGGER IF EXISTS trigger_auto_xp ON public.points_transactions;
DROP FUNCTION IF EXISTS public.auto_add_xp_on_points_earned();
