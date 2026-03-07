
-- Drop the RESTRICTIVE ALL policy on reviews that blocks unauthenticated viewing
DROP POLICY IF EXISTS "Require authentication for reviews" ON public.reviews;

-- The existing permissive policies are sufficient:
-- "Anyone can view reviews" (SELECT, qual: true)
-- "Users can create their own reviews" (INSERT, with_check: auth.uid() = user_id)
-- "Users can update their own reviews" (UPDATE, qual: auth.uid() = user_id)
-- "Users can delete their own reviews" (DELETE, qual: auth.uid() = user_id)
-- "Admins can delete any review" (DELETE, qual: has_role)
