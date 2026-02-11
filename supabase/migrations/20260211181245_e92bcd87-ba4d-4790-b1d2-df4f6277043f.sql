
-- ============================================
-- Merchant Reels Discovery System - Phase 1+2
-- ============================================

-- 1. Main reels table
CREATE TABLE public.merchant_reels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchant_applications(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.merchant_products(id) ON DELETE SET NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT CHECK (char_length(caption) <= 120),
  category_id UUID REFERENCES public.community_categories(id) ON DELETE SET NULL,
  duration_seconds NUMERIC(6,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
  rejection_reason TEXT,
  -- Analytics counters (denormalized for fast reads)
  views_count INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  saves_count INTEGER NOT NULL DEFAULT 0,
  clicks_count INTEGER NOT NULL DEFAULT 0,
  full_watches_count INTEGER NOT NULL DEFAULT 0,
  -- Scoring
  quality_score NUMERIC(5,3) DEFAULT 0,
  ranking_score NUMERIC(8,4) DEFAULT 0,
  business_multiplier NUMERIC(4,3) DEFAULT 1.0,
  is_sponsored BOOLEAN DEFAULT false,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  first_1000_impressions_at TIMESTAMPTZ
);

-- Index for feed queries
CREATE INDEX idx_merchant_reels_status_score ON public.merchant_reels(status, ranking_score DESC) WHERE status = 'approved';
CREATE INDEX idx_merchant_reels_merchant ON public.merchant_reels(merchant_id);
CREATE INDEX idx_merchant_reels_category ON public.merchant_reels(category_id);
CREATE INDEX idx_merchant_reels_created ON public.merchant_reels(created_at DESC);

-- 2. Reel interactions (likes, saves)
CREATE TABLE public.reel_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reel_id UUID NOT NULL REFERENCES public.merchant_reels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('like', 'save', 'share')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reel_id, user_id, interaction_type)
);

CREATE INDEX idx_reel_interactions_reel ON public.reel_interactions(reel_id);
CREATE INDEX idx_reel_interactions_user ON public.reel_interactions(user_id);

-- 3. Reel views (for analytics and personalization)
CREATE TABLE public.reel_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reel_id UUID NOT NULL REFERENCES public.merchant_reels(id) ON DELETE CASCADE,
  user_id UUID,
  watch_duration_seconds NUMERIC(6,2) DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  skipped_early BOOLEAN DEFAULT false, -- skipped within 3 seconds
  clicked_product BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reel_views_reel ON public.reel_views(reel_id);
CREATE INDEX idx_reel_views_user ON public.reel_views(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_reel_views_created ON public.reel_views(created_at DESC);

-- 4. Reel upload settings (admin configurable)
INSERT INTO public.community_settings (key, value, description)
VALUES (
  'reels_settings',
  '{"max_file_size_mb": 50, "max_duration_seconds": 45, "min_duration_seconds": 10, "daily_upload_limit": 5, "auto_approve": false, "cold_start_boost_impressions": 1000}'::jsonb,
  'إعدادات نظام الريلز - الحجم الأقصى، المدة، حد الرفع اليومي'
);

-- 5. Trigger to update updated_at
CREATE TRIGGER update_merchant_reels_updated_at
  BEFORE UPDATE ON public.merchant_reels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Function to increment view counters atomically
CREATE OR REPLACE FUNCTION public.record_reel_view(
  p_reel_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_watch_duration NUMERIC DEFAULT 0,
  p_completed BOOLEAN DEFAULT false,
  p_skipped_early BOOLEAN DEFAULT false,
  p_clicked_product BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert view record
  INSERT INTO public.reel_views (reel_id, user_id, watch_duration_seconds, completed, skipped_early, clicked_product)
  VALUES (p_reel_id, p_user_id, p_watch_duration, p_completed, p_skipped_early, p_clicked_product);
  
  -- Update denormalized counters
  UPDATE public.merchant_reels
  SET 
    views_count = views_count + 1,
    full_watches_count = CASE WHEN p_completed THEN full_watches_count + 1 ELSE full_watches_count END,
    clicks_count = CASE WHEN p_clicked_product THEN clicks_count + 1 ELSE clicks_count END,
    -- Set first 1000 impressions timestamp
    first_1000_impressions_at = CASE 
      WHEN first_1000_impressions_at IS NULL AND views_count + 1 >= 1000 THEN now()
      ELSE first_1000_impressions_at
    END
  WHERE id = p_reel_id;
END;
$$;

-- 7. Function to toggle like/save
CREATE OR REPLACE FUNCTION public.toggle_reel_interaction(
  p_reel_id UUID,
  p_user_id UUID,
  p_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existed BOOLEAN;
BEGIN
  -- Try to delete existing
  DELETE FROM public.reel_interactions
  WHERE reel_id = p_reel_id AND user_id = p_user_id AND interaction_type = p_type;
  
  v_existed := FOUND;
  
  IF v_existed THEN
    -- Decrement counter
    IF p_type = 'like' THEN
      UPDATE public.merchant_reels SET likes_count = GREATEST(0, likes_count - 1) WHERE id = p_reel_id;
    ELSIF p_type = 'save' THEN
      UPDATE public.merchant_reels SET saves_count = GREATEST(0, saves_count - 1) WHERE id = p_reel_id;
    END IF;
    RETURN false; -- removed
  ELSE
    -- Insert new
    INSERT INTO public.reel_interactions (reel_id, user_id, interaction_type)
    VALUES (p_reel_id, p_user_id, p_type);
    
    IF p_type = 'like' THEN
      UPDATE public.merchant_reels SET likes_count = likes_count + 1 WHERE id = p_reel_id;
    ELSIF p_type = 'save' THEN
      UPDATE public.merchant_reels SET saves_count = saves_count + 1 WHERE id = p_reel_id;
    END IF;
    RETURN true; -- added
  END IF;
END;
$$;

-- 8. RLS Policies
ALTER TABLE public.merchant_reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_views ENABLE ROW LEVEL SECURITY;

-- merchant_reels: everyone can view approved reels
CREATE POLICY "Anyone can view approved reels"
  ON public.merchant_reels FOR SELECT
  USING (status = 'approved');

-- Merchants can view their own reels (any status)
CREATE POLICY "Merchants can view own reels"
  ON public.merchant_reels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.merchant_applications ma
      WHERE ma.id = merchant_id AND ma.user_id = auth.uid()
    )
  );

-- Merchants can insert their own reels
CREATE POLICY "Merchants can create reels"
  ON public.merchant_reels FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.merchant_applications ma
      WHERE ma.id = merchant_id AND ma.user_id = auth.uid() AND ma.status = 'approved'
    )
  );

-- Merchants can update their own reels
CREATE POLICY "Merchants can update own reels"
  ON public.merchant_reels FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.merchant_applications ma
      WHERE ma.id = merchant_id AND ma.user_id = auth.uid()
    )
  );

-- Merchants can delete their own reels
CREATE POLICY "Merchants can delete own reels"
  ON public.merchant_reels FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.merchant_applications ma
      WHERE ma.id = merchant_id AND ma.user_id = auth.uid()
    )
  );

-- Admins can do everything
CREATE POLICY "Admins full access to reels"
  ON public.merchant_reels FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- reel_interactions: users can manage their own
CREATE POLICY "Users can view own interactions"
  ON public.reel_interactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create interactions"
  ON public.reel_interactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own interactions"
  ON public.reel_interactions FOR DELETE
  USING (user_id = auth.uid());

-- reel_views: insert only (via RPC mostly, but allow direct too)
CREATE POLICY "Anyone can insert views"
  ON public.reel_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all reel views"
  ON public.reel_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Storage bucket for reel videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('merchant-reels', 'merchant-reels', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for merchant-reels bucket
CREATE POLICY "Anyone can view reel videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'merchant-reels');

CREATE POLICY "Merchants can upload reel videos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'merchant-reels' AND auth.uid() IS NOT NULL);

CREATE POLICY "Merchants can update own reel videos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'merchant-reels' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Merchants can delete own reel videos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'merchant-reels' AND auth.uid()::text = (storage.foldername(name))[1]);
