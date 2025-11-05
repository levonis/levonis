-- Add color, speed, and direction columns to announcements table
ALTER TABLE public.announcements 
ADD COLUMN color TEXT DEFAULT '#3b82f6',
ADD COLUMN speed INTEGER DEFAULT 20,
ADD COLUMN direction TEXT DEFAULT 'right';