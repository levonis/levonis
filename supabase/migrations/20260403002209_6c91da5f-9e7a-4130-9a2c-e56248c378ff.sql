
-- Fix 1: Remove public SELECT policy on payment-proofs bucket and make it private
DROP POLICY IF EXISTS "Payment proofs are publicly accessible" ON storage.objects;

UPDATE storage.buckets SET public = false WHERE id = 'payment-proofs';

-- Fix 2: Restrict product_batches to admin-only access
DROP POLICY IF EXISTS "Authenticated users can view batches" ON public.product_batches;
DROP POLICY IF EXISTS "Authenticated users can create batches" ON public.product_batches;
DROP POLICY IF EXISTS "Authenticated users can update batches" ON public.product_batches;
DROP POLICY IF EXISTS "Authenticated users can delete batches" ON public.product_batches;

CREATE POLICY "Only admins can manage product batches"
  ON public.product_batches FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Fix 3: Restrict user_points direct reads to owner and admin only
-- (Public loyalty levels are already safely exposed via get_user_level RPC)
DROP POLICY IF EXISTS "Anyone can view user levels" ON public.user_points;

CREATE POLICY "Users can view own points"
  ON public.user_points FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all points"
  ON public.user_points FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
