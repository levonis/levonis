
-- Add AMS support to trade-in
ALTER TABLE public.trade_in_requests
  ADD COLUMN IF NOT EXISTS has_ams BOOLEAN NOT NULL DEFAULT false;

-- Seed AMS condition rule (idempotent)
INSERT INTO public.trade_in_valuation_rules
  (rule_key, label_ar, label_en, label_ku, rule_type, adjust_percent, display_order, is_active)
VALUES
  ('has_ams','تأتي مع جهاز AMS','Comes with AMS unit','لەگەڵ ئامێری AMS دێت','condition_adjust',15,14,true)
ON CONFLICT (rule_key) DO NOTHING;

-- Replace estimator RPC with AMS-aware version (keep old signature for backward compat)
CREATE OR REPLACE FUNCTION public.estimate_trade_in_value(
  _eligible_printer_id UUID,
  _operating_hours INTEGER,
  _has_original_box BOOLEAN,
  _has_receipt BOOLEAN,
  _has_scratches BOOLEAN,
  _has_defects BOOLEAN,
  _has_ams BOOLEAN DEFAULT false
) RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  base_val NUMERIC;
  multiplier NUMERIC := 100;
  adjust NUMERIC := 0;
  raw_val NUMERIC;
BEGIN
  SELECT base_trade_in_value INTO base_val FROM public.trade_in_eligible_printers
    WHERE id = _eligible_printer_id AND is_active = true;
  IF base_val IS NULL THEN RETURN 0; END IF;

  SELECT COALESCE(multiplier_percent, 100) INTO multiplier
    FROM public.trade_in_valuation_rules
    WHERE rule_type = 'hours_tier' AND is_active = true
      AND COALESCE(_operating_hours,0) >= COALESCE(min_hours,0)
      AND (max_hours IS NULL OR COALESCE(_operating_hours,0) < max_hours)
    ORDER BY min_hours DESC LIMIT 1;

  SELECT COALESCE(SUM(adjust_percent),0) INTO adjust FROM public.trade_in_valuation_rules
    WHERE rule_type = 'condition_adjust' AND is_active = true AND (
      (rule_key = 'has_original_box' AND _has_original_box) OR
      (rule_key = 'has_receipt' AND _has_receipt) OR
      (rule_key = 'has_scratches' AND _has_scratches) OR
      (rule_key = 'has_defects' AND _has_defects) OR
      (rule_key = 'has_ams' AND _has_ams)
    );

  raw_val := base_val * (multiplier / 100.0) * (1 + adjust / 100.0);
  IF raw_val < 0 THEN raw_val := 0; END IF;
  RETURN floor(raw_val / 250.0) * 250;
END;
$$;
GRANT EXECUTE ON FUNCTION public.estimate_trade_in_value(uuid,integer,boolean,boolean,boolean,boolean,boolean) TO authenticated, service_role;
