-- Create storage bucket for invoice assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoice-assets', 'invoice-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for invoice assets bucket
CREATE POLICY "Anyone can view invoice assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoice-assets');

CREATE POLICY "Admins can upload invoice assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoice-assets' AND
  (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  ))
);

CREATE POLICY "Admins can update invoice assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'invoice-assets' AND
  (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  ))
);

CREATE POLICY "Admins can delete invoice assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'invoice-assets' AND
  (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  ))
);