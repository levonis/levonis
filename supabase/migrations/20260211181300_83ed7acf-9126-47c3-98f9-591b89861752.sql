
-- Fix overly permissive reel_views INSERT policy
DROP POLICY IF EXISTS "Anyone can insert views" ON public.reel_views;

-- Only allow inserts where the reel exists and is approved
CREATE POLICY "Users can record reel views"
  ON public.reel_views FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.merchant_reels mr
      WHERE mr.id = reel_id AND mr.status = 'approved'
    )
  );
