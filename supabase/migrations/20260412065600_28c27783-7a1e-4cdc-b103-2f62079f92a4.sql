
ALTER TABLE crossy_road_settings
  ADD COLUMN IF NOT EXISTS score_per_step integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS score_per_coin integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_daily_points integer,
  ADD COLUMN IF NOT EXISTS season_ends_at timestamptz;

ALTER TABLE crossy_road_high_scores
  ADD COLUMN IF NOT EXISTS all_time_high_score integer DEFAULT 0;

UPDATE crossy_road_high_scores SET all_time_high_score = high_score WHERE true;
