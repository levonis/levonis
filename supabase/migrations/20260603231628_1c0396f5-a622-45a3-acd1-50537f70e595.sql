
-- ============== stl_categories ==============
CREATE TABLE public.stl_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text,
  name_ku text,
  slug text NOT NULL UNIQUE,
  icon text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stl_categories TO anon, authenticated;
GRANT ALL ON public.stl_categories TO service_role;
ALTER TABLE public.stl_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stl_categories_select_public" ON public.stl_categories
  FOR SELECT USING (is_active OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "stl_categories_admin_all" ON public.stl_categories
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============== stl_files ==============
CREATE TABLE public.stl_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.stl_categories(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  title_ar text NOT NULL,
  title_en text,
  title_ku text,
  description_ar text,
  description_en text,
  description_ku text,
  cover_image_url text,
  gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  video_url text,
  model_preview_url text,
  download_file_path text,
  file_size_bytes bigint,
  file_format text,
  tags text[] NOT NULL DEFAULT '{}',
  price_type text NOT NULL DEFAULT 'free',
  price_points numeric NOT NULL DEFAULT 0,
  min_card_tier_id uuid REFERENCES public.membership_cards(id) ON DELETE SET NULL,
  downloads_count integer NOT NULL DEFAULT 0,
  views_count integer NOT NULL DEFAULT 0,
  rejection_reason text,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stl_files_status_chk CHECK (status IN ('pending','approved','rejected')),
  CONSTRAINT stl_files_price_type_chk CHECK (price_type IN ('free','paid','daily_limit'))
);
CREATE INDEX stl_files_status_idx ON public.stl_files(status);
CREATE INDEX stl_files_category_idx ON public.stl_files(category_id);
CREATE INDEX stl_files_uploader_idx ON public.stl_files(uploader_id);
CREATE INDEX stl_files_tags_idx ON public.stl_files USING gin(tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stl_files TO authenticated;
GRANT ALL ON public.stl_files TO service_role;
ALTER TABLE public.stl_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stl_files_select" ON public.stl_files
  FOR SELECT TO authenticated USING (
    status = 'approved'
    OR uploader_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );
CREATE POLICY "stl_files_insert_own_pending" ON public.stl_files
  FOR INSERT TO authenticated WITH CHECK (
    uploader_id = auth.uid() AND status = 'pending'
  );
CREATE POLICY "stl_files_update_own_pending" ON public.stl_files
  FOR UPDATE TO authenticated USING (
    (uploader_id = auth.uid() AND status = 'pending')
    OR public.has_role(auth.uid(), 'admin'::app_role)
  ) WITH CHECK (
    uploader_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );
CREATE POLICY "stl_files_delete_own_pending" ON public.stl_files
  FOR DELETE TO authenticated USING (
    (uploader_id = auth.uid() AND status = 'pending')
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ============== stl_file_downloads ==============
CREATE TABLE public.stl_file_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES public.stl_files(id) ON DELETE CASCADE,
  downloaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stl_file_downloads_user_day_idx ON public.stl_file_downloads(user_id, downloaded_at);
CREATE INDEX stl_file_downloads_file_idx ON public.stl_file_downloads(file_id);

GRANT SELECT, INSERT ON public.stl_file_downloads TO authenticated;
GRANT ALL ON public.stl_file_downloads TO service_role;
ALTER TABLE public.stl_file_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stl_downloads_select_own" ON public.stl_file_downloads
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)
  );
CREATE POLICY "stl_downloads_insert_own" ON public.stl_file_downloads
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============== stl_card_download_limits ==============
CREATE TABLE public.stl_card_download_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL UNIQUE REFERENCES public.membership_cards(id) ON DELETE CASCADE,
  daily_download_limit integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stl_card_download_limits TO authenticated;
GRANT ALL ON public.stl_card_download_limits TO service_role;
ALTER TABLE public.stl_card_download_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stl_card_limits_select" ON public.stl_card_download_limits
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "stl_card_limits_admin_all" ON public.stl_card_download_limits
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============== updated_at trigger ==============
CREATE OR REPLACE FUNCTION public.stl_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER stl_categories_set_updated_at BEFORE UPDATE ON public.stl_categories
  FOR EACH ROW EXECUTE FUNCTION public.stl_set_updated_at();
CREATE TRIGGER stl_files_set_updated_at BEFORE UPDATE ON public.stl_files
  FOR EACH ROW EXECUTE FUNCTION public.stl_set_updated_at();
CREATE TRIGGER stl_card_limits_set_updated_at BEFORE UPDATE ON public.stl_card_download_limits
  FOR EACH ROW EXECUTE FUNCTION public.stl_set_updated_at();

-- ============== eligibility function ==============
CREATE OR REPLACE FUNCTION public.can_access_stl_library(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_applications ma
    WHERE ma.user_id = _uid AND ma.status = 'approved'
  ) AND EXISTS (
    SELECT 1 FROM public.user_cards uc
    WHERE uc.user_id = _uid
      AND uc.is_active = true
      AND (uc.expires_at IS NULL OR uc.expires_at > now())
  );
$$;
GRANT EXECUTE ON FUNCTION public.can_access_stl_library(uuid) TO authenticated, anon;
