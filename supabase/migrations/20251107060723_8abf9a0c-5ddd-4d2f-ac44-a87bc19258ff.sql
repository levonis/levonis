-- Add auto_rotate and display_duration columns to announcements table
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS auto_rotate boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS display_duration integer DEFAULT 5;

COMMENT ON COLUMN public.announcements.auto_rotate IS 'Auto-rotate between multiple announcements';
COMMENT ON COLUMN public.announcements.display_duration IS 'Display duration in seconds for each announcement';