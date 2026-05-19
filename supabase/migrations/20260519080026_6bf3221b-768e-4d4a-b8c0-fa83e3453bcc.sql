
-- ============ print_materials ============
CREATE TABLE IF NOT EXISTS public.print_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  name_ku text,
  density_g_cm3 numeric NOT NULL,
  cost_per_kg_iqd integer NOT NULL,
  shrinkage_pct numeric NOT NULL DEFAULT 0.2,
  default_infill_pct numeric NOT NULL DEFAULT 20,
  default_layer_height_mm numeric NOT NULL DEFAULT 0.2,
  default_nozzle_mm numeric NOT NULL DEFAULT 0.4,
  default_print_speed_mm_s numeric NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.print_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_materials_select_active"
  ON public.print_materials FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "print_materials_admin_all"
  ON public.print_materials FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_print_materials_updated
  BEFORE UPDATE ON public.print_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.print_materials
  (code, name_ar, name_en, name_ku, density_g_cm3, cost_per_kg_iqd, shrinkage_pct, default_infill_pct, display_order)
VALUES
  ('pla',  'PLA',  'PLA',  'PLA',  1.24, 25000, 0.20, 20, 10),
  ('petg', 'PETG', 'PETG', 'PETG', 1.27, 32000, 0.40, 20, 20),
  ('abs',  'ABS',  'ABS',  'ABS',  1.04, 30000, 0.80, 25, 30),
  ('tpu',  'TPU',  'TPU',  'TPU',  1.21, 45000, 0.30, 30, 40)
ON CONFLICT (code) DO NOTHING;

-- ============ print_machine_profiles ============
CREATE TABLE IF NOT EXISTS public.print_machine_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hourly_cost_iqd integer NOT NULL DEFAULT 2000,
  nozzle_flow_rate_cm3_min numeric NOT NULL DEFAULT 8,
  travel_overhead_per_layer_sec numeric NOT NULL DEFAULT 1.5,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.print_machine_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_machine_profiles_select_active"
  ON public.print_machine_profiles FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "print_machine_profiles_admin_all"
  ON public.print_machine_profiles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_print_machine_profiles_updated
  BEFORE UPDATE ON public.print_machine_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.print_machine_profiles
  (name, hourly_cost_iqd, nozzle_flow_rate_cm3_min, travel_overhead_per_layer_sec, is_default)
VALUES ('Default FDM (Bambu A1 class)', 2000, 8, 1.5, true)
ON CONFLICT DO NOTHING;

-- ============ print_quote_cache: add columns ============
ALTER TABLE public.print_quote_cache
  ADD COLUMN IF NOT EXISTS file_hash text,
  ADD COLUMN IF NOT EXISTS analysis_payload jsonb,
  ADD COLUMN IF NOT EXISTS material_code text;

CREATE UNIQUE INDEX IF NOT EXISTS print_quote_cache_file_hash_key
  ON public.print_quote_cache (file_hash) WHERE file_hash IS NOT NULL;

-- ============ Storage bucket ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('print-quote-files', 'print-quote-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "print_quote_files_owner_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'print-quote-files'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "print_quote_files_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'print-quote-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "print_quote_files_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'print-quote-files'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );
