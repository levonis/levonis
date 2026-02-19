-- Fix: Allow users to update their own requests when status is pending_review, approved, or rejected
DROP POLICY IF EXISTS "Users can update their own pending requests" ON public.community_print_requests;

CREATE POLICY "Users can update their own pending requests"
ON public.community_print_requests
FOR UPDATE
USING (
  auth.uid() = user_id
  AND status = ANY (ARRAY['pending_review', 'approved', 'rejected'])
)
WITH CHECK (
  auth.uid() = user_id
  AND status = ANY (ARRAY['pending_review', 'approved', 'rejected'])
);

-- Also fix delete policy to include approved
DROP POLICY IF EXISTS "Users can delete their own pending requests" ON public.community_print_requests;

CREATE POLICY "Users can delete their own pending requests"
ON public.community_print_requests
FOR DELETE
USING (
  auth.uid() = user_id
  AND status = ANY (ARRAY['pending_review', 'approved', 'rejected'])
);