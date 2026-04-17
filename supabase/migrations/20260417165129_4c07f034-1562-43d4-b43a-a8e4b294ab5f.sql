-- 1. Add season fields to settings tables
ALTER TABLE public.stack_game_settings
  ADD COLUMN IF NOT EXISTS season_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS season_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS season_name TEXT DEFAULT 'الموسم الأول';

ALTER TABLE public.knife_rain_settings
  ADD COLUMN IF NOT EXISTS season_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS season_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS season_name TEXT DEFAULT 'الموسم الأول';

ALTER TABLE public.crossy_road_settings
  ADD COLUMN IF NOT EXISTS season_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS season_name TEXT DEFAULT 'الموسم الأول';

-- 2. Add all_time_high_score to high score tables
ALTER TABLE public.stack_game_high_scores
  ADD COLUMN IF NOT EXISTS all_time_high_score INTEGER DEFAULT 0;

ALTER TABLE public.knife_rain_high_scores
  ADD COLUMN IF NOT EXISTS all_time_high_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS season INTEGER DEFAULT 1;

-- Initialize all_time values from current high scores
UPDATE public.stack_game_high_scores
  SET all_time_high_score = GREATEST(COALESCE(all_time_high_score, 0), COALESCE(high_score, 0))
  WHERE all_time_high_score IS NULL OR all_time_high_score < high_score;

UPDATE public.knife_rain_high_scores
  SET all_time_high_score = GREATEST(COALESCE(all_time_high_score, 0), COALESCE(high_score, 0))
  WHERE all_time_high_score IS NULL OR all_time_high_score < high_score;

-- 3. Trigger function to keep all_time_high_score updated
CREATE OR REPLACE FUNCTION public.update_all_time_high_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.all_time_high_score := GREATEST(
    COALESCE(NEW.all_time_high_score, 0),
    COALESCE(OLD.all_time_high_score, 0),
    COALESCE(NEW.high_score, 0)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stack_all_time ON public.stack_game_high_scores;
CREATE TRIGGER trg_stack_all_time
  BEFORE INSERT OR UPDATE ON public.stack_game_high_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_all_time_high_score();

DROP TRIGGER IF EXISTS trg_knife_all_time ON public.knife_rain_high_scores;
CREATE TRIGGER trg_knife_all_time
  BEFORE INSERT OR UPDATE ON public.knife_rain_high_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_all_time_high_score();