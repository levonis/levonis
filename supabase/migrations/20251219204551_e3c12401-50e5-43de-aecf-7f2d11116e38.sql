
-- Create storage bucket for competition images
INSERT INTO storage.buckets (id, name, public)
VALUES ('competition-images', 'competition-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for competition images
CREATE POLICY "Anyone can view competition images"
ON storage.objects FOR SELECT
USING (bucket_id = 'competition-images');

CREATE POLICY "Admins can upload competition images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'competition-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update competition images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'competition-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete competition images"
ON storage.objects FOR DELETE
USING (bucket_id = 'competition-images' AND has_role(auth.uid(), 'admin'::app_role));
