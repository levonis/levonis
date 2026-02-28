
-- Columns already added by previous migration (video_url, points_awarded)
-- Just verify they exist
SELECT column_name FROM information_schema.columns WHERE table_name = 'reviews' AND column_name IN ('video_url', 'points_awarded');
