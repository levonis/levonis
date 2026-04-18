
-- Create app_versions table to track APK releases
CREATE TABLE public.app_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  download_url TEXT NOT NULL,
  file_size_mb NUMERIC,
  release_notes_ar TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_latest BOOLEAN NOT NULL DEFAULT false,
  min_android_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_versions_platform_active ON public.app_versions(platform, is_active, created_at DESC);

ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

-- Anyone (even anonymous) can view active versions
CREATE POLICY "Anyone can view active app versions"
ON public.app_versions FOR SELECT
USING (is_active = true);

-- Only admins can manage versions
CREATE POLICY "Admins can insert app versions"
ON public.app_versions FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update app versions"
ON public.app_versions FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete app versions"
ON public.app_versions FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to update updated_at
CREATE TRIGGER update_app_versions_updated_at
BEFORE UPDATE ON public.app_versions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to ensure only one is_latest per platform
CREATE OR REPLACE FUNCTION public.ensure_single_latest_app_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_latest = true THEN
    UPDATE public.app_versions
    SET is_latest = false
    WHERE platform = NEW.platform
      AND id <> NEW.id
      AND is_latest = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ensure_single_latest_app_version_trigger
BEFORE INSERT OR UPDATE ON public.app_versions
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_latest_app_version();

-- Create public storage bucket for APK releases
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-releases',
  'app-releases',
  true,
  524288000, -- 500MB
  ARRAY['application/vnd.android.package-archive', 'application/octet-stream', 'application/zip']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 524288000,
  allowed_mime_types = ARRAY['application/vnd.android.package-archive', 'application/octet-stream', 'application/zip'];

-- Storage policies: public read, admin write
CREATE POLICY "Anyone can download app releases"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-releases');

CREATE POLICY "Admins can upload app releases"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'app-releases'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update app releases"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'app-releases'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete app releases"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'app-releases'
  AND public.has_role(auth.uid(), 'admin')
);
