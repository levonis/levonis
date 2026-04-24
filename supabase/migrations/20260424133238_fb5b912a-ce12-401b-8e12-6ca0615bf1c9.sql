-- 1) Create singleton settings table
CREATE TABLE IF NOT EXISTS public.announcement_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speed INTEGER NOT NULL DEFAULT 20,
  direction TEXT NOT NULL DEFAULT 'right' CHECK (direction IN ('left','right')),
  gap INTEGER NOT NULL DEFAULT 16,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  auto_rotate BOOLEAN NOT NULL DEFAULT true,
  display_duration INTEGER NOT NULL DEFAULT 5,
  always_move BOOLEAN NOT NULL DEFAULT false,
  is_singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Seed the single row from the most recent announcement (if any)
INSERT INTO public.announcement_settings (speed, direction, gap, color, auto_rotate, display_duration, always_move)
SELECT
  COALESCE(speed, 20),
  CASE WHEN direction IN ('left','right') THEN direction ELSE 'right' END,
  COALESCE(gap, 16),
  COALESCE(color, '#3b82f6'),
  COALESCE(auto_rotate, true),
  COALESCE(display_duration, 5),
  COALESCE(always_move, false)
FROM public.announcements
ORDER BY created_at DESC
LIMIT 1
ON CONFLICT (is_singleton) DO NOTHING;

-- Ensure at least one row exists
INSERT INTO public.announcement_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.announcement_settings)
ON CONFLICT DO NOTHING;

-- 3) RLS
ALTER TABLE public.announcement_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view announcement settings"
ON public.announcement_settings
FOR SELECT
USING (true);

CREATE POLICY "Admins can update announcement settings"
ON public.announcement_settings
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert announcement settings"
ON public.announcement_settings
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) Trigger to keep updated_at fresh
CREATE TRIGGER update_announcement_settings_updated_at
BEFORE UPDATE ON public.announcement_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();