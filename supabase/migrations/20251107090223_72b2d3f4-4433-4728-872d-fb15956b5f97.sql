-- Add always_move flag to announcements
ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS always_move boolean NOT NULL DEFAULT false;