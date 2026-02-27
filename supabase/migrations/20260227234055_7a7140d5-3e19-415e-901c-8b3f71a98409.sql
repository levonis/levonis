
-- Add total_xp to user_points (tracks all-time XP, never decreases)
ALTER TABLE public.user_points ADD COLUMN IF NOT EXISTS total_xp numeric NOT NULL DEFAULT 0;

-- Add xp_required to loyalty_levels (replaces purchase-based progression)
ALTER TABLE public.loyalty_levels ADD COLUMN IF NOT EXISTS xp_required numeric NOT NULL DEFAULT 0;

-- Create trigger to auto-calculate XP when points are earned
-- Every 1 point earned = 2 XP
CREATE OR REPLACE FUNCTION public.auto_add_xp_on_points_earned()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'earned' THEN
    UPDATE public.user_points 
    SET total_xp = total_xp + (NEW.points * 2)
    WHERE user_id = NEW.user_id;
    
    -- Auto-update user level based on XP
    UPDATE public.user_points 
    SET level = COALESCE(
      (SELECT ll.level_key FROM public.loyalty_levels ll 
       WHERE ll.xp_required <= (SELECT up.total_xp FROM public.user_points up WHERE up.user_id = NEW.user_id)
       ORDER BY ll.xp_required DESC LIMIT 1),
      'bronze'
    )
    WHERE user_id = NEW.user_id;
    
    -- Auto-update user_cards to reflect current level
    -- Deactivate old cards
    UPDATE public.user_cards SET is_active = false WHERE user_id = NEW.user_id AND is_active = true;
    
    -- Insert/update active card for current level
    INSERT INTO public.user_cards (user_id, level_id, is_active, expires_at, points_spent)
    SELECT NEW.user_id, ll.id, true, '2099-12-31'::timestamptz, 0
    FROM public.loyalty_levels ll
    WHERE ll.level_key = (SELECT up.level FROM public.user_points up WHERE up.user_id = NEW.user_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_auto_xp ON public.points_transactions;
CREATE TRIGGER trigger_auto_xp
  AFTER INSERT ON public.points_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_xp_on_points_earned();

-- Backfill existing XP from total_points (total_points * 2 = XP)
UPDATE public.user_points SET total_xp = total_points * 2;
