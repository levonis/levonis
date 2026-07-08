-- Restrict print_ratings public SELECT to authenticated users only
DROP POLICY IF EXISTS "Public can view print ratings" ON public.print_ratings;

CREATE POLICY "Authenticated users can view print ratings"
ON public.print_ratings
FOR SELECT
TO authenticated
USING (true);