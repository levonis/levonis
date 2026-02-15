
-- Story sections
CREATE TABLE public.story_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title_ar TEXT NOT NULL,
  thumbnail_url TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Story videos
CREATE TABLE public.story_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.story_sections(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  duration_seconds INT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_story_videos_section ON public.story_videos(section_id);
CREATE INDEX idx_story_sections_order ON public.story_sections(display_order);

ALTER TABLE public.story_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active story sections" ON public.story_sections FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can view active story videos" ON public.story_videos FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage story sections" ON public.story_sections FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can manage story videos" ON public.story_videos FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Seed data
INSERT INTO public.story_sections (id, title_ar, thumbnail_url, display_order) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'عروض اليوم', 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=200&h=200&fit=crop', 1),
  ('a1000000-0000-0000-0000-000000000002', 'وصل حديثاً', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&h=200&fit=crop', 2),
  ('a1000000-0000-0000-0000-000000000003', 'أفضل المبيعات', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop', 3),
  ('a1000000-0000-0000-0000-000000000004', 'تقنية', 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=200&h=200&fit=crop', 4),
  ('a1000000-0000-0000-0000-000000000005', 'اكسسوارات', 'https://images.unsplash.com/photo-1625929675093-a85a18f3a0e9?w=200&h=200&fit=crop', 5);

INSERT INTO public.story_videos (section_id, video_url, duration_seconds, display_order) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 15, 1),
  ('a1000000-0000-0000-0000-000000000001', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', 15, 2),
  ('a1000000-0000-0000-0000-000000000002', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', 60, 1),
  ('a1000000-0000-0000-0000-000000000002', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', 15, 2),
  ('a1000000-0000-0000-0000-000000000003', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', 15, 1),
  ('a1000000-0000-0000-0000-000000000004', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', 30, 1),
  ('a1000000-0000-0000-0000-000000000005', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', 30, 1);
