
-- 1) process_type on materials
ALTER TABLE public.print_materials
  ADD COLUMN IF NOT EXISTS process_type text NOT NULL DEFAULT 'fdm';
ALTER TABLE public.print_materials
  DROP CONSTRAINT IF EXISTS print_materials_process_type_chk;
ALTER TABLE public.print_materials
  ADD CONSTRAINT print_materials_process_type_chk CHECK (process_type IN ('fdm','resin','sls'));

-- 2) process_type + queue on machines
ALTER TABLE public.print_machine_profiles
  ADD COLUMN IF NOT EXISTS process_type text NOT NULL DEFAULT 'fdm';
ALTER TABLE public.print_machine_profiles
  DROP CONSTRAINT IF EXISTS print_machine_profiles_process_type_chk;
ALTER TABLE public.print_machine_profiles
  ADD CONSTRAINT print_machine_profiles_process_type_chk CHECK (process_type IN ('fdm','resin','sls'));
ALTER TABLE public.print_machine_profiles
  ADD COLUMN IF NOT EXISTS current_queue_count integer NOT NULL DEFAULT 0;

-- 3) Quotations table
CREATE TABLE IF NOT EXISTS public.print_quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quote_number text NOT NULL UNIQUE DEFAULT ('Q-' || to_char(now(),'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6)),
  source text NOT NULL CHECK (source IN ('file','url','manual')),
  process_type text NOT NULL DEFAULT 'fdm' CHECK (process_type IN ('fdm','resin','sls')),
  material_code text,
  rush_tier text NOT NULL DEFAULT 'standard' CHECK (rush_tier IN ('standard','fast','rush')),
  qty integer NOT NULL DEFAULT 1 CHECK (qty BETWEEN 1 AND 1000),
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_iqd integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'IQD',
  difficulty_score integer,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','accepted','converted','cancelled')),
  pdf_url text,
  print_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_print_quotations_user ON public.print_quotations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_quotations_status ON public.print_quotations(status);

ALTER TABLE public.print_quotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS print_quotations_select_own ON public.print_quotations;
CREATE POLICY print_quotations_select_own ON public.print_quotations
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS print_quotations_insert_own ON public.print_quotations;
CREATE POLICY print_quotations_insert_own ON public.print_quotations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS print_quotations_update_own ON public.print_quotations;
CREATE POLICY print_quotations_update_own ON public.print_quotations
  FOR UPDATE USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS print_quotations_admin_all ON public.print_quotations;
CREATE POLICY print_quotations_admin_all ON public.print_quotations
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_print_quotations_updated ON public.print_quotations;
CREATE TRIGGER trg_print_quotations_updated
  BEFORE UPDATE ON public.print_quotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Seed sample resin + SLS materials
INSERT INTO public.print_materials
  (code, name_ar, name_en, name_ku, density_g_cm3, cost_per_kg_iqd, shrinkage_pct, default_infill_pct, default_layer_height_mm, default_nozzle_mm, default_print_speed_mm_s, is_active, display_order, process_type)
VALUES
  ('resin_std', 'راتنج قياسي', 'Standard Resin', 'ڕەزینی پارێزراو', 1.10, 55000, 0.5, 100, 0.05, 0, 0, true, 50, 'resin'),
  ('resin_tough', 'راتنج صلب', 'Tough Resin', 'ڕەزینی توند', 1.15, 75000, 0.5, 100, 0.05, 0, 0, true, 51, 'resin'),
  ('sls_pa12', 'بودرة PA12', 'PA12 Powder (SLS)', 'پۆدرە PA12', 1.01, 95000, 0.3, 100, 0.10, 0, 0, true, 60, 'sls')
ON CONFLICT (code) DO UPDATE SET process_type = EXCLUDED.process_type;

-- 5) Default machine profiles for resin/sls
INSERT INTO public.print_machine_profiles (name, hourly_cost_iqd, nozzle_flow_rate_cm3_min, travel_overhead_per_layer_sec, is_default, is_active, process_type)
SELECT 'Default Resin (SLA/DLP)', 2500, 0, 6, false, true, 'resin'
WHERE NOT EXISTS (SELECT 1 FROM public.print_machine_profiles WHERE process_type='resin');

INSERT INTO public.print_machine_profiles (name, hourly_cost_iqd, nozzle_flow_rate_cm3_min, travel_overhead_per_layer_sec, is_default, is_active, process_type)
SELECT 'Default SLS', 8000, 0, 0, false, true, 'sls'
WHERE NOT EXISTS (SELECT 1 FROM public.print_machine_profiles WHERE process_type='sls');

-- 6) Upsert global pricing config
INSERT INTO public.community_settings (key, value)
VALUES ('quote_pricing', jsonb_build_object(
  'base', jsonb_build_object(
    'electricity_kwh_iqd', 250,
    'depreciation_pct', 0.05,
    'labor_per_hour_iqd', 3000,
    'packaging_iqd', 1500,
    'shipping_default_iqd', 5000,
    'platform_fee_pct', 0.017,
    'profit_margin_pct', 0.15,
    'min_range_pct', 0.90,
    'max_range_pct', 1.15,
    'min_order_iqd', 5000,
    'round_to_iqd', 250,
    'base_complexity_fee', 1500
  ),
  'risk', jsonb_build_object(
    'complexity_mult', jsonb_build_object('easy',1.0,'medium',1.5,'hard',2.2),
    'overhang_mult_per_10pct', 0.08,
    'large_model_threshold_cm3', 200,
    'large_model_mult', 1.15,
    'multipart_labor_per_part_iqd', 1500
  ),
  'rush', jsonb_build_object(
    'standard', jsonb_build_object('mult',1.0,'days',7),
    'fast',     jsonb_build_object('mult',1.25,'days',3),
    'rush',     jsonb_build_object('mult',1.6, 'days',1)
  ),
  'bulk_tiers', jsonb_build_array(
    jsonb_build_object('min_qty',5,'discount_pct',0.05),
    jsonb_build_object('min_qty',10,'discount_pct',0.10),
    jsonb_build_object('min_qty',25,'discount_pct',0.18)
  ),
  'load_balancing', jsonb_build_object(
    'enabled', true,
    'queue_low_mult', 0.95,
    'queue_high_mult', 1.10,
    'high_threshold_pending', 5
  ),
  'processes', jsonb_build_object(
    'fdm', jsonb_build_object('enabled',true,'machine_kw',0.15,'failure_rate_pct',0.05,'support_mult',1.0,'post_processing_min',5),
    'resin', jsonb_build_object('enabled',true,'machine_kw',0.06,'failure_rate_pct',0.08,'support_mult',1.2,'post_processing_min',20,'wash_cure_iqd',2000,'resin_waste_pct',0.15),
    'sls', jsonb_build_object('enabled',true,'machine_kw',3.5,'failure_rate_pct',0.03,'support_mult',1.0,'post_processing_min',15,'powder_refresh_pct',0.30,'packing_density',0.08)
  )
))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
