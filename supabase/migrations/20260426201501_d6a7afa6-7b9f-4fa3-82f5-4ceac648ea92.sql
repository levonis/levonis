ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS message_en TEXT,
  ADD COLUMN IF NOT EXISTS message_ku TEXT;