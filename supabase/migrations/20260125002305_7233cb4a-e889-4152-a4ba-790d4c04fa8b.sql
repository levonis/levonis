-- Drop existing function and recreate with settings from database
DROP FUNCTION IF EXISTS public.calculate_merchant_badge_tier(UUID);

CREATE OR REPLACE FUNCTION public.calculate_merchant_badge_tier(p_merchant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_orders INTEGER := 0;
  v_current_month_orders INTEGER := 0;
  v_prev_month_orders INTEGER := 0;
  v_prev2_month_orders INTEGER := 0;
  v_current_month TEXT;
  v_prev_month TEXT;
  v_prev2_month TEXT;
  v_badge_tier TEXT := 'none';
  
  -- Settings from database
  v_silver_min INTEGER;
  v_silver_max INTEGER;
  v_gold_min INTEGER;
  v_gold_max INTEGER;
  v_diamond1_min INTEGER;
  v_diamond2_monthly INTEGER;
  v_diamond3_monthly INTEGER;
  v_diamond4_monthly INTEGER;
  v_emerald_monthly INTEGER;
  v_continuity_months INTEGER;
BEGIN
  -- Load settings from merchant_badge_settings table
  SELECT COALESCE((SELECT setting_value FROM merchant_badge_settings WHERE setting_key = 'silver_min'), 11) INTO v_silver_min;
  SELECT COALESCE((SELECT setting_value FROM merchant_badge_settings WHERE setting_key = 'silver_max'), 50) INTO v_silver_max;
  SELECT COALESCE((SELECT setting_value FROM merchant_badge_settings WHERE setting_key = 'gold_min'), 51) INTO v_gold_min;
  SELECT COALESCE((SELECT setting_value FROM merchant_badge_settings WHERE setting_key = 'gold_max'), 100) INTO v_gold_max;
  SELECT COALESCE((SELECT setting_value FROM merchant_badge_settings WHERE setting_key = 'diamond1_min'), 101) INTO v_diamond1_min;
  SELECT COALESCE((SELECT setting_value FROM merchant_badge_settings WHERE setting_key = 'diamond2_monthly'), 500) INTO v_diamond2_monthly;
  SELECT COALESCE((SELECT setting_value FROM merchant_badge_settings WHERE setting_key = 'diamond3_monthly'), 1000) INTO v_diamond3_monthly;
  SELECT COALESCE((SELECT setting_value FROM merchant_badge_settings WHERE setting_key = 'diamond4_monthly'), 2000) INTO v_diamond4_monthly;
  SELECT COALESCE((SELECT setting_value FROM merchant_badge_settings WHERE setting_key = 'emerald_monthly'), 3000) INTO v_emerald_monthly;
  SELECT COALESCE((SELECT setting_value FROM merchant_badge_settings WHERE setting_key = 'continuity_months'), 2) INTO v_continuity_months;

  -- Calculate months
  v_current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  v_prev_month := TO_CHAR(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM');
  v_prev2_month := TO_CHAR(CURRENT_DATE - INTERVAL '2 months', 'YYYY-MM');

  -- Get total completed orders for this merchant
  SELECT COUNT(*) INTO v_total_orders
  FROM print_offers
  WHERE trader_id = p_merchant_id
    AND status = 'completed';

  -- Get monthly order counts
  SELECT COALESCE(completed_orders, 0) INTO v_current_month_orders
  FROM merchant_monthly_orders
  WHERE merchant_id = p_merchant_id AND year_month = v_current_month;

  SELECT COALESCE(completed_orders, 0) INTO v_prev_month_orders
  FROM merchant_monthly_orders
  WHERE merchant_id = p_merchant_id AND year_month = v_prev_month;

  SELECT COALESCE(completed_orders, 0) INTO v_prev2_month_orders
  FROM merchant_monthly_orders
  WHERE merchant_id = p_merchant_id AND year_month = v_prev2_month;

  -- Check for Emerald (3000+ monthly for consecutive months)
  IF v_current_month_orders >= v_emerald_monthly 
     AND v_prev_month_orders >= v_emerald_monthly 
     AND v_prev2_month_orders >= v_emerald_monthly THEN
    RETURN 'emerald';
  END IF;

  -- Check for Diamond 4 (2000+ monthly for consecutive months)
  IF v_current_month_orders >= v_diamond4_monthly 
     AND v_prev_month_orders >= v_diamond4_monthly THEN
    RETURN 'diamond4';
  END IF;

  -- Check for Diamond 3 (1000+ monthly for consecutive months)
  IF v_current_month_orders >= v_diamond3_monthly 
     AND v_prev_month_orders >= v_diamond3_monthly THEN
    RETURN 'diamond3';
  END IF;

  -- Check for Diamond 2 (500+ monthly for consecutive months)
  IF v_current_month_orders >= v_diamond2_monthly 
     AND v_prev_month_orders >= v_diamond2_monthly THEN
    RETURN 'diamond2';
  END IF;

  -- Check for Diamond 1 (101+ total orders)
  IF v_total_orders >= v_diamond1_min THEN
    RETURN 'diamond1';
  END IF;

  -- Check for Gold (51-100 total orders)
  IF v_total_orders >= v_gold_min AND v_total_orders <= v_gold_max THEN
    RETURN 'gold';
  END IF;

  -- Check for Silver (11-50 total orders)
  IF v_total_orders >= v_silver_min AND v_total_orders <= v_silver_max THEN
    RETURN 'silver';
  END IF;

  -- Default: no badge
  RETURN 'none';
END;
$$;