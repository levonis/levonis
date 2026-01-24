-- Create table to track monthly order counts for badge calculation
CREATE TABLE IF NOT EXISTS public.merchant_monthly_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL,
  year_month TEXT NOT NULL, -- format: YYYY-MM
  completed_orders INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, year_month)
);

-- Enable RLS
ALTER TABLE public.merchant_monthly_orders ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view merchant monthly orders" 
  ON public.merchant_monthly_orders FOR SELECT 
  USING (true);

CREATE POLICY "Admins can manage merchant monthly orders" 
  ON public.merchant_monthly_orders FOR ALL 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_merchant_monthly_orders_updated_at
  BEFORE UPDATE ON public.merchant_monthly_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_merchant_badge_settings_updated_at();

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_merchant_monthly_orders_merchant 
  ON public.merchant_monthly_orders(merchant_id, year_month DESC);

-- Function to calculate badge tier based on order counts
CREATE OR REPLACE FUNCTION public.calculate_merchant_badge_tier(
  p_merchant_id UUID,
  p_settings JSONB DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_month TEXT;
  v_current_count INTEGER;
  v_continuity_months INTEGER;
  v_consecutive_count INTEGER;
  v_tier TEXT := 'none';
  v_settings JSONB;
  v_month_record RECORD;
BEGIN
  -- Get settings
  IF p_settings IS NULL THEN
    SELECT jsonb_object_agg(setting_key, setting_value) INTO v_settings
    FROM merchant_badge_settings;
  ELSE
    v_settings := p_settings;
  END IF;

  -- Get current month
  v_current_month := to_char(now(), 'YYYY-MM');
  
  -- Get current month's completed orders (last 30 days approximation)
  SELECT COALESCE(completed_orders, 0) INTO v_current_count
  FROM merchant_monthly_orders
  WHERE merchant_id = p_merchant_id AND year_month = v_current_month;

  IF v_current_count IS NULL THEN
    v_current_count := 0;
  END IF;

  -- Check for emerald tier first (highest monthly threshold)
  IF v_current_count >= COALESCE((v_settings->>'emerald_monthly')::INTEGER, 3000) THEN
    -- Check continuity for emerald
    v_continuity_months := COALESCE((v_settings->>'continuity_months')::INTEGER, 2);
    v_consecutive_count := 0;
    
    FOR v_month_record IN
      SELECT year_month, completed_orders
      FROM merchant_monthly_orders
      WHERE merchant_id = p_merchant_id
        AND year_month < v_current_month
      ORDER BY year_month DESC
      LIMIT v_continuity_months
    LOOP
      IF v_month_record.completed_orders >= COALESCE((v_settings->>'emerald_monthly')::INTEGER, 3000) THEN
        v_consecutive_count := v_consecutive_count + 1;
      ELSE
        EXIT;
      END IF;
    END LOOP;
    
    IF v_consecutive_count >= v_continuity_months THEN
      RETURN 'emerald';
    END IF;
  END IF;

  -- Check diamond tiers (4, 3, 2, 1)
  IF v_current_count >= COALESCE((v_settings->>'diamond4_monthly')::INTEGER, 2000) THEN
    v_continuity_months := COALESCE((v_settings->>'continuity_months')::INTEGER, 2);
    v_consecutive_count := 0;
    
    FOR v_month_record IN
      SELECT year_month, completed_orders
      FROM merchant_monthly_orders
      WHERE merchant_id = p_merchant_id AND year_month < v_current_month
      ORDER BY year_month DESC
      LIMIT v_continuity_months
    LOOP
      IF v_month_record.completed_orders >= COALESCE((v_settings->>'diamond4_monthly')::INTEGER, 2000) THEN
        v_consecutive_count := v_consecutive_count + 1;
      ELSE
        EXIT;
      END IF;
    END LOOP;
    
    IF v_consecutive_count >= v_continuity_months THEN
      RETURN 'diamond_4';
    END IF;
  END IF;

  IF v_current_count >= COALESCE((v_settings->>'diamond3_monthly')::INTEGER, 1000) THEN
    v_continuity_months := COALESCE((v_settings->>'continuity_months')::INTEGER, 2);
    v_consecutive_count := 0;
    
    FOR v_month_record IN
      SELECT year_month, completed_orders
      FROM merchant_monthly_orders
      WHERE merchant_id = p_merchant_id AND year_month < v_current_month
      ORDER BY year_month DESC
      LIMIT v_continuity_months
    LOOP
      IF v_month_record.completed_orders >= COALESCE((v_settings->>'diamond3_monthly')::INTEGER, 1000) THEN
        v_consecutive_count := v_consecutive_count + 1;
      ELSE
        EXIT;
      END IF;
    END LOOP;
    
    IF v_consecutive_count >= v_continuity_months THEN
      RETURN 'diamond_3';
    END IF;
  END IF;

  IF v_current_count >= COALESCE((v_settings->>'diamond2_monthly')::INTEGER, 500) THEN
    v_continuity_months := COALESCE((v_settings->>'continuity_months')::INTEGER, 2);
    v_consecutive_count := 0;
    
    FOR v_month_record IN
      SELECT year_month, completed_orders
      FROM merchant_monthly_orders
      WHERE merchant_id = p_merchant_id AND year_month < v_current_month
      ORDER BY year_month DESC
      LIMIT v_continuity_months
    LOOP
      IF v_month_record.completed_orders >= COALESCE((v_settings->>'diamond2_monthly')::INTEGER, 500) THEN
        v_consecutive_count := v_consecutive_count + 1;
      ELSE
        EXIT;
      END IF;
    END LOOP;
    
    IF v_consecutive_count >= v_continuity_months THEN
      RETURN 'diamond_2';
    END IF;
  END IF;

  -- Diamond 1: cumulative threshold (not monthly with continuity)
  IF v_current_count >= COALESCE((v_settings->>'diamond1_min')::INTEGER, 101) THEN
    RETURN 'diamond_1';
  END IF;

  -- Gold tier
  IF v_current_count >= COALESCE((v_settings->>'gold_min')::INTEGER, 51) THEN
    RETURN 'gold';
  END IF;

  -- Silver tier
  IF v_current_count >= COALESCE((v_settings->>'silver_min')::INTEGER, 11) THEN
    RETURN 'silver';
  END IF;

  RETURN 'none';
END;
$$;

COMMENT ON TABLE public.merchant_monthly_orders IS 'تتبع عدد الطلبات الشهرية لكل تاجر لحساب الشارات';
COMMENT ON FUNCTION public.calculate_merchant_badge_tier IS 'حساب مستوى شارة التاجر بناءً على الطلبات والاستمرارية';