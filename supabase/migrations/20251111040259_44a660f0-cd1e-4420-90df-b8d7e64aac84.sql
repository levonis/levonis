-- Create storage bucket for serial number images
INSERT INTO storage.buckets (id, name, public)
VALUES ('serial-number-images', 'serial-number-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for serial number images bucket
CREATE POLICY "Admins can upload serial number images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'serial-number-images' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can update serial number images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'serial-number-images' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete serial number images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'serial-number-images' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Anyone can view serial number images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'serial-number-images');