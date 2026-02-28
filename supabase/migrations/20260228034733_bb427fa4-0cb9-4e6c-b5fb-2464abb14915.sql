
-- Table for review helpful/likes
CREATE TABLE public.review_helpful (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(review_id, user_id)
);

ALTER TABLE public.review_helpful ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view helpful counts" ON public.review_helpful FOR SELECT USING (true);
CREATE POLICY "Authenticated users can mark helpful" ON public.review_helpful FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their helpful" ON public.review_helpful FOR DELETE USING (auth.uid() = user_id);

-- Table for review reports
CREATE TABLE public.review_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(review_id, user_id)
);

ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can report reviews" ON public.review_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can see own reports" ON public.review_reports FOR SELECT USING (auth.uid() = user_id);
