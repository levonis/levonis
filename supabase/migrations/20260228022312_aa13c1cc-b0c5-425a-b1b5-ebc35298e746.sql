
-- Add media columns to merchant_ratings
ALTER TABLE public.merchant_ratings 
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS video_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS points_awarded integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;

-- Create rating replies table for user Q&A and admin replies
CREATE TABLE IF NOT EXISTS public.merchant_rating_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id uuid REFERENCES public.merchant_ratings(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  is_admin_reply boolean DEFAULT false,
  parent_id uuid REFERENCES public.merchant_rating_comments(id) ON DELETE CASCADE,
  is_hidden boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.merchant_rating_comments ENABLE ROW LEVEL SECURITY;

-- Everyone can read visible comments
CREATE POLICY "Anyone can view rating comments"
ON public.merchant_rating_comments FOR SELECT
USING (is_hidden = false OR public.has_role(auth.uid(), 'admin'));

-- Authenticated users can add comments
CREATE POLICY "Authenticated users can comment"
ON public.merchant_rating_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
ON public.merchant_rating_comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Users can delete their own, admin can delete any
CREATE POLICY "Users can delete own comments"
ON public.merchant_rating_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Update merchant_ratings RLS to allow admin to update/delete any
DROP POLICY IF EXISTS "Customers can update their own ratings" ON public.merchant_ratings;
CREATE POLICY "Customers or admin can update ratings"
ON public.merchant_ratings FOR UPDATE
TO authenticated
USING (auth.uid() = customer_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Customers can delete their own ratings" ON public.merchant_ratings;
CREATE POLICY "Customers or admin can delete ratings"
ON public.merchant_ratings FOR DELETE
TO authenticated
USING (auth.uid() = customer_id OR public.has_role(auth.uid(), 'admin'));

-- Also allow insert from print_requests (fix the error - allow both tables)
DROP POLICY IF EXISTS "Customers can insert ratings" ON public.merchant_ratings;
CREATE POLICY "Customers can insert ratings"
ON public.merchant_ratings FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = customer_id 
  AND (
    EXISTS (
      SELECT 1 FROM community_print_requests pr
      WHERE pr.id = merchant_ratings.request_id AND pr.user_id = auth.uid() AND pr.status = 'delivered'
    )
    OR EXISTS (
      SELECT 1 FROM print_requests pr
      WHERE pr.id = merchant_ratings.request_id AND pr.user_id = auth.uid() AND pr.status = 'delivered'
    )
  )
);

-- Update the view to exclude hidden ratings
DROP VIEW IF EXISTS public.merchant_rating_stats;
CREATE VIEW public.merchant_rating_stats AS
SELECT merchant_id,
  count(*) AS total_ratings,
  (avg(rating))::numeric(3,2) AS average_rating,
  count(CASE WHEN rating = 5 THEN 1 END) AS five_stars,
  count(CASE WHEN rating = 4 THEN 1 END) AS four_stars,
  count(CASE WHEN rating = 3 THEN 1 END) AS three_stars,
  count(CASE WHEN rating = 2 THEN 1 END) AS two_stars,
  count(CASE WHEN rating = 1 THEN 1 END) AS one_star
FROM merchant_ratings
WHERE is_hidden = false
GROUP BY merchant_id;
