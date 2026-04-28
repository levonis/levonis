
-- 1) Drop stale public-read policy for non-existent print-request-files bucket
DROP POLICY IF EXISTS "Public read print-request-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload print-request-files" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own print-request-files" ON storage.objects;
DROP POLICY IF EXISTS "Users update own print-request-files" ON storage.objects;

-- 2) community_complaints: prevent reported user from seeing admin_notes
DROP POLICY IF EXISTS "Users can view own complaints" ON public.community_complaints;

-- Only the complainant keeps full row access
CREATE POLICY "Complainants can view their own complaints"
ON public.community_complaints
FOR SELECT
USING (auth.uid() = complainant_id);

-- Sanitized view for the reported party (excludes admin_notes / resolution / resolved_by)
CREATE OR REPLACE VIEW public.community_complaints_safe AS
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

-- 3) Restrict public-read user-activity tables to authenticated only
DROP POLICY IF EXISTS "Everyone can view likes" ON public.community_likes;
CREATE POLICY "Authenticated can view likes"
ON public.community_likes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view story likes" ON public.merchant_story_likes;
CREATE POLICY "Authenticated can view story likes"
ON public.merchant_story_likes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view helpful counts" ON public.review_helpful;
CREATE POLICY "Authenticated can view helpful"
ON public.review_helpful FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view entries" ON public.merchant_giveaway_entries;
CREATE POLICY "Authenticated can view entries"
ON public.merchant_giveaway_entries FOR SELECT TO authenticated USING (true);

-- wish_likes / store_followers: same treatment if a public select exists
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT polname, polrelid::regclass::text AS tbl
    FROM pg_policy
    WHERE polrelid IN ('public.wish_likes'::regclass, 'public.store_followers'::regclass)
      AND polcmd = 'r'
      AND pg_get_expr(polqual, polrelid) = 'true'
  LOOP
    EXECUTE format('DROP POLICY %I ON %s', r.polname, r.tbl);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.wish_likes'::regclass) THEN
    EXECUTE 'CREATE POLICY "Authenticated can view wish likes" ON public.wish_likes FOR SELECT TO authenticated USING (true)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.store_followers'::regclass) THEN
    EXECUTE 'CREATE POLICY "Authenticated can view store followers" ON public.store_followers FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- 4) Realtime: require authenticated subscription
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can receive broadcasts" ON realtime.messages;
CREATE POLICY "Authenticated can receive broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);
