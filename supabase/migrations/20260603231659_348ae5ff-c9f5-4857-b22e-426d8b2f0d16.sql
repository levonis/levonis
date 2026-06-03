
-- stl-files: private; only owner can read/write own folder; admin full
CREATE POLICY "stl_files_obj_select_own" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'stl-files' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );
CREATE POLICY "stl_files_obj_insert_own" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'stl-files' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "stl_files_obj_update_own" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'stl-files' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );
CREATE POLICY "stl_files_obj_delete_own" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'stl-files' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- stl-previews: public read; owner write in own folder
CREATE POLICY "stl_previews_obj_select_public" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'stl-previews');
CREATE POLICY "stl_previews_obj_insert_own" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'stl-previews' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "stl_previews_obj_update_own" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'stl-previews' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );
CREATE POLICY "stl_previews_obj_delete_own" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'stl-previews' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );
