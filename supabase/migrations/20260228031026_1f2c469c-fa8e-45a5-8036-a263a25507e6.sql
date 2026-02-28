
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS points_awarded integer DEFAULT 0;
