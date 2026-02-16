
-- Merchant stories table (24-hour expiry)
CREATE TABLE public.merchant_stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL,
  product_id UUID REFERENCES public.merchant_products(id) ON DELETE SET NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image', -- 'image' or 'video'
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  views_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Likes for merchant stories
CREATE TABLE public.merchant_story_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.merchant_stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(story_id, user_id)
);

-- Enable RLS
ALTER TABLE public.merchant_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_story_likes ENABLE ROW LEVEL SECURITY;

-- Stories policies
CREATE POLICY "Anyone can view active stories" ON public.merchant_stories
  FOR SELECT USING (is_active = true AND expires_at > now());

CREATE POLICY "Merchants can create their own stories" ON public.merchant_stories
  FOR INSERT WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "Merchants can update their own stories" ON public.merchant_stories
  FOR UPDATE USING (auth.uid() = merchant_id);

CREATE POLICY "Merchants can delete their own stories" ON public.merchant_stories
  FOR DELETE USING (auth.uid() = merchant_id);

-- Story likes policies
CREATE POLICY "Anyone can view story likes" ON public.merchant_story_likes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can like stories" ON public.merchant_story_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own likes" ON public.merchant_story_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Index for fast expiry queries
CREATE INDEX idx_merchant_stories_active_expires ON public.merchant_stories(is_active, expires_at DESC);
CREATE INDEX idx_merchant_stories_merchant ON public.merchant_stories(merchant_id);
CREATE INDEX idx_merchant_story_likes_story ON public.merchant_story_likes(story_id);
