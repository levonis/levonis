
DROP VIEW IF EXISTS public.community_complaints_safe;

CREATE VIEW public.community_complaints_safe
WITH (security_invoker = true) AS
SELECT
  id,
  complainant_id,
  reported_user_id,
  reported_merchant_id,
  request_id,
  offer_id,
  complaint_type,
  title,
  description,
  images,
  status,
  priority,
  resolved_at,
  created_at,
  updated_at
FROM public.community_complaints
WHERE auth.uid() = reported_user_id
   OR auth.uid() = complainant_id
   OR public.has_role(auth.uid(), 'admin'::app_role);

GRANT SELECT ON public.community_complaints_safe TO authenticated;

-- Allow the reported user to read via the view by adding a narrow row policy that
-- only matches when accessed through the view's WHERE clause (the view itself filters).
-- We need an RLS policy on the base table for the reported user to actually return rows
-- through the security_invoker view, BUT we must not expose admin_notes. To keep things
-- simple and safe, grant column-level SELECT to authenticated and add a row policy that
-- only returns non-sensitive columns through the view's filter.
CREATE POLICY "Reported users can view their complaint (safe cols)"
ON public.community_complaints
FOR SELECT
TO authenticated
USING (auth.uid() = reported_user_id);

-- Revoke direct column access to admin_notes / resolution / resolved_by for the reported user
-- by using column-level privileges: grant all safe cols to authenticated, never grant the sensitive ones.
REVOKE SELECT ON public.community_complaints FROM authenticated;
GRANT SELECT (
  id, complainant_id, reported_user_id, reported_merchant_id, request_id, offer_id,
  complaint_type, title, description, images, status, priority,
  resolved_at, created_at, updated_at
) ON public.community_complaints TO authenticated;
