
-- Re-add a limited SELECT policy for community_customer_profiles
-- Other users can see non-sensitive fields (reputation, verified status, etc.) but RLS is row-level not column-level
-- So we need to allow SELECT but rely on the view for column filtering
CREATE POLICY "Authenticated users can view non-suspended profiles"
  ON public.community_customer_profiles
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND (
      auth.uid() = user_id 
      OR public.has_role(auth.uid(), 'admin')
      OR is_suspended = false
    )
  );

-- Drop the user-only policy since the new one covers it
DROP POLICY IF EXISTS "Users can view own community profile" ON public.community_customer_profiles;
