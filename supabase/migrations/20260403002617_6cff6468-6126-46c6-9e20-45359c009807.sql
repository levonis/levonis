
-- Fix 1: user_collected_letters - Change permissive ALL policy to restrictive
DROP POLICY IF EXISTS "Require authentication for collected letters" ON public.user_collected_letters;

CREATE POLICY "Require authentication for collected letters"
  ON public.user_collected_letters
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fix 2: uploads bucket - Scope write policies to user's own folder + admin override
DROP POLICY IF EXISTS "Allow authenticated users to upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete uploads" ON storage.objects;

-- Users can only upload to their own folder or task-proofs/{their_id}/
CREATE POLICY "Users upload to own folder in uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'uploads' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR ((storage.foldername(name))[1] = 'task-proofs' AND (storage.foldername(name))[2] = auth.uid()::text)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

CREATE POLICY "Users update own folder in uploads"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'uploads' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR ((storage.foldername(name))[1] = 'task-proofs' AND (storage.foldername(name))[2] = auth.uid()::text)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

CREATE POLICY "Users delete own folder in uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'uploads' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR ((storage.foldername(name))[1] = 'task-proofs' AND (storage.foldername(name))[2] = auth.uid()::text)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );
