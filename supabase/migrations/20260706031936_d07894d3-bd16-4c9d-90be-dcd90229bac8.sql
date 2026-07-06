
-- ============ TRADE-IN FEATURE ============

-- 1) Eligible printers admin-controls
CREATE TABLE public.trade_in_eligible_printers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,
  printer_model TEXT NOT NULL,
  base_trade_in_value NUMERIC NOT NULL DEFAULT 0,
  max_operating_hours INTEGER,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trade_in_eligible_printers TO authenticated, anon;
GRANT ALL ON public.trade_in_eligible_printers TO service_role;
ALTER TABLE public.trade_in_eligible_printers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active eligible printers" ON public.trade_in_eligible_printers
  FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage eligible printers" ON public.trade_in_eligible_printers
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_trade_in_elig_updated BEFORE UPDATE ON public.trade_in_eligible_printers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Valuation rules (single-row global config held as jsonb tiers, or multi-row rules)
CREATE TABLE public.trade_in_valuation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_key TEXT NOT NULL UNIQUE,
  label_ar TEXT NOT NULL,
  label_en TEXT,
  label_ku TEXT,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('hours_tier','condition_adjust')),
  -- for hours_tier: min_hours/max_hours + multiplier_percent (e.g. 100, 80, 60)
  -- for condition_adjust: adjust_percent can be positive or negative
  min_hours INTEGER,
  max_hours INTEGER,
  multiplier_percent NUMERIC,
  adjust_percent NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trade_in_valuation_rules TO authenticated, anon;
GRANT ALL ON public.trade_in_valuation_rules TO service_role;
ALTER TABLE public.trade_in_valuation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active valuation rules" ON public.trade_in_valuation_rules
  FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage valuation rules" ON public.trade_in_valuation_rules
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_trade_in_rules_updated BEFORE UPDATE ON public.trade_in_valuation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default rules
INSERT INTO public.trade_in_valuation_rules (rule_key,label_ar,label_en,label_ku,rule_type,min_hours,max_hours,multiplier_percent,display_order) VALUES
  ('hours_0_500','0 - 500 ساعة','0 - 500 hours','0 - 500 کاتژمێر','hours_tier',0,500,100,1),
  ('hours_500_1500','500 - 1500 ساعة','500 - 1500 hours','500 - 1500 کاتژمێر','hours_tier',500,1500,80,2),
  ('hours_1500_3000','1500 - 3000 ساعة','1500 - 3000 hours','1500 - 3000 کاتژمێر','hours_tier',1500,3000,60,3),
  ('hours_3000_plus','أكثر من 3000 ساعة','over 3000 hours','زیاتر لە 3000 کاتژمێر','hours_tier',3000,NULL,40,4);
INSERT INTO public.trade_in_valuation_rules (rule_key,label_ar,label_en,label_ku,rule_type,adjust_percent,display_order) VALUES
  ('has_original_box','الكرتون الأصلي متوفر','Has original box','قوتوی ڕەسەن هەیە','condition_adjust',5,10),
  ('has_receipt','وصل الشراء متوفر','Has purchase receipt','پسوولەی کڕین هەیە','condition_adjust',5,11),
  ('has_scratches','خدوش أو أضرار سطحية','Scratches or surface damage','خەشە یان زیانی سەرووەیی','condition_adjust',-15,12),
  ('has_defects','عطل أو عيب في التشغيل','Operating defects','کێشەی کارکردن','condition_adjust',-30,13);

-- 3) Requests
CREATE TABLE public.trade_in_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  eligible_printer_id UUID REFERENCES public.trade_in_eligible_printers(id) ON DELETE SET NULL,
  target_new_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  operating_hours INTEGER NOT NULL DEFAULT 0,
  printer_brand TEXT,
  printer_model TEXT,
  purchase_source TEXT,
  has_original_box BOOLEAN NOT NULL DEFAULT false,
  has_receipt BOOLEAN NOT NULL DEFAULT false,
  has_scratches BOOLEAN NOT NULL DEFAULT false,
  has_defects BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  receipt_image_url TEXT,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_coupon_value NUMERIC NOT NULL DEFAULT 0,
  final_coupon_value NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved_pending_inspection','inspected_adjusted','coupon_issued','rejected','cancelled')),
  admin_notes TEXT,
  rejection_reason TEXT,
  issued_coupon_id UUID,
  issued_coupon_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.trade_in_requests TO authenticated;
GRANT ALL ON public.trade_in_requests TO service_role;
ALTER TABLE public.trade_in_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own requests" ON public.trade_in_requests
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Users create own requests" ON public.trade_in_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending_review');
CREATE POLICY "Users cancel own pending requests" ON public.trade_in_requests
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending_review')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending_review','cancelled'));
CREATE POLICY "Admins manage all requests" ON public.trade_in_requests
  FOR ALL USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_trade_in_req_updated BEFORE UPDATE ON public.trade_in_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_trade_in_requests_user ON public.trade_in_requests(user_id, created_at DESC);
CREATE INDEX idx_trade_in_requests_status ON public.trade_in_requests(status, created_at DESC);

-- 4) Extend user_coupons for product restriction (used by trade-in)
ALTER TABLE public.user_coupons
  ADD COLUMN IF NOT EXISTS product_restriction_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trade_in_request_id UUID REFERENCES public.trade_in_requests(id) ON DELETE SET NULL;

-- 5) Server-side estimator RPC
CREATE OR REPLACE FUNCTION public.estimate_trade_in_value(
  _eligible_printer_id UUID,
  _operating_hours INTEGER,
  _has_original_box BOOLEAN,
  _has_receipt BOOLEAN,
  _has_scratches BOOLEAN,
  _has_defects BOOLEAN
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
      (rule_key = 'has_defects' AND _has_defects)
    );

  raw_val := base_val * (multiplier / 100.0) * (1 + adjust / 100.0);
  IF raw_val < 0 THEN raw_val := 0; END IF;
  RETURN floor(raw_val / 250.0) * 250;
END;
$$;
GRANT EXECUTE ON FUNCTION public.estimate_trade_in_value(uuid,integer,boolean,boolean,boolean,boolean) TO authenticated, service_role;

-- 6) Admin RPC to issue coupon after inspection
CREATE OR REPLACE FUNCTION public.admin_issue_trade_in_coupon(
  _request_id UUID,
  _final_value NUMERIC,
  _admin_notes TEXT DEFAULT NULL,
  _valid_days INTEGER DEFAULT 30
) RETURNS TABLE(coupon_code TEXT, coupon_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  req RECORD;
  new_code TEXT;
  new_id UUID;
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  SELECT * INTO req FROM public.trade_in_requests WHERE id = _request_id FOR UPDATE;
  IF req IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF req.status = 'coupon_issued' THEN RAISE EXCEPTION 'already_issued'; END IF;
  IF _final_value <= 0 THEN RAISE EXCEPTION 'invalid_value'; END IF;

  new_code := 'TRADEIN-' || upper(substr(md5(gen_random_uuid()::text),1,8));
  new_id := gen_random_uuid();

  INSERT INTO public.user_coupons (
    id, user_id, coupon_code, discount_value, discount_type,
    expires_at, source, product_restriction_id, trade_in_request_id
  ) VALUES (
    new_id, req.user_id, new_code, _final_value, 'fixed',
    now() + (_valid_days || ' days')::interval,
    'trade_in', req.target_new_product_id, req.id
  );

  UPDATE public.trade_in_requests SET
    status = 'coupon_issued',
    final_coupon_value = _final_value,
    admin_notes = COALESCE(_admin_notes, admin_notes),
    issued_coupon_id = new_id,
    issued_coupon_code = new_code,
    updated_at = now()
  WHERE id = _request_id;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    req.user_id, 'trade_in_coupon',
    'تم إصدار كوبون الاستبدال',
    'كوبون خصم بقيمة ' || _final_value::text || ' د.ع جاهز للاستخدام',
    jsonb_build_object('coupon_code', new_code, 'request_id', req.id)
  );

  RETURN QUERY SELECT new_code, new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_issue_trade_in_coupon(uuid,numeric,text,integer) TO authenticated, service_role;

-- 7) Storage policies for trade-in-uploads bucket (path = {user_id}/...)
CREATE POLICY "trade_in_uploads_owner_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'trade-in-uploads' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY "trade_in_uploads_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trade-in-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "trade_in_uploads_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'trade-in-uploads' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(),'admin'::app_role)));
