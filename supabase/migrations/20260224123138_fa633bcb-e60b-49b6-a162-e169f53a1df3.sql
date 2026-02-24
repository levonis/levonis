
-- Create table for game music stations
CREATE TABLE public.game_music_stations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name_ar TEXT NOT NULL,
  file_url TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_music_stations ENABLE ROW LEVEL SECURITY;

-- Everyone can read active stations
CREATE POLICY "Anyone can view active music stations"
  ON public.game_music_stations FOR SELECT
  USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage music stations"
  ON public.game_music_stations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Storage bucket for game music files
INSERT INTO storage.buckets (id, name, public) VALUES ('game-music', 'game-music', true);

-- Anyone can read game music files
CREATE POLICY "Public read game music" ON storage.objects
  FOR SELECT USING (bucket_id = 'game-music');

-- Admins can upload game music
CREATE POLICY "Admins upload game music" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'game-music'
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Admins can delete game music
CREATE POLICY "Admins delete game music" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'game-music'
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Trigger for updated_at
CREATE TRIGGER update_game_music_stations_updated_at
  BEFORE UPDATE ON public.game_music_stations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
