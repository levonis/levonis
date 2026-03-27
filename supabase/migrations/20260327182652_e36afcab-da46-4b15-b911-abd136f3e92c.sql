
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- Update existing reviews to approved
UPDATE public.reviews SET status = 'approved' WHERE status = 'pending';

-- Add index for faster admin queries
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);

-- Allow admins to update reviews (they already have admin role check via has_role)
CREATE POLICY "Admins can view all reviews"
ON public.reviews FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reviews"
ON public.reviews FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
