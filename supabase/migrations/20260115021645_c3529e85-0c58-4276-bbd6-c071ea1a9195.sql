-- Update protection_plans table with new fields for advanced features
ALTER TABLE public.protection_plans ADD COLUMN IF NOT EXISTS max_service_requests_per_month integer DEFAULT 1;
ALTER TABLE public.protection_plans ADD COLUMN IF NOT EXISTS maintenance_discount_percentage integer DEFAULT 10;
ALTER TABLE public.protection_plans ADD COLUMN IF NOT EXISTS parts_discount_percentage integer DEFAULT 5;
ALTER TABLE public.protection_plans ADD COLUMN IF NOT EXISTS waiting_period_days integer DEFAULT 30;
ALTER TABLE public.protection_plans ADD COLUMN IF NOT EXISTS annual_coverage_cap numeric DEFAULT NULL;
ALTER TABLE public.protection_plans ADD COLUMN IF NOT EXISTS priority_level integer DEFAULT 1;
ALTER TABLE public.protection_plans ADD COLUMN IF NOT EXISTS has_preventive_maintenance boolean DEFAULT false;
ALTER TABLE public.protection_plans ADD COLUMN IF NOT EXISTS preventive_maintenance_interval_months integer DEFAULT NULL;
ALTER TABLE public.protection_plans ADD COLUMN IF NOT EXISTS has_replacement_printer boolean DEFAULT false;
ALTER TABLE public.protection_plans ADD COLUMN IF NOT EXISTS icon_name text DEFAULT 'shield';
ALTER TABLE public.protection_plans ADD COLUMN IF NOT EXISTS badge_text text DEFAULT NULL;

-- Update printer_subscriptions table
ALTER TABLE public.printer_subscriptions ADD COLUMN IF NOT EXISTS auto_renew boolean DEFAULT true;
ALTER TABLE public.printer_subscriptions ADD COLUMN IF NOT EXISTS waiting_period_ends_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.printer_subscriptions ADD COLUMN IF NOT EXISTS service_requests_this_month integer DEFAULT 0;
ALTER TABLE public.printer_subscriptions ADD COLUMN IF NOT EXISTS last_service_request_reset timestamp with time zone DEFAULT NULL;

-- Create table for serial number requests
CREATE TABLE IF NOT EXISTS public.serial_number_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_name_ar text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  resolved_by uuid
);

-- Enable RLS on serial_number_requests
ALTER TABLE public.serial_number_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for serial_number_requests
CREATE POLICY "Users can view their own serial requests" 
  ON public.serial_number_requests 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own serial requests" 
  ON public.serial_number_requests 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all serial requests" 
  ON public.serial_number_requests 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update serial requests" 
  ON public.serial_number_requests 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Insert default protection plans with new features (upsert)
INSERT INTO public.protection_plans (
  plan_type, name_ar, name_en, description_ar, description_en, monthly_price, 
  features, display_order, is_active,
  max_service_requests_per_month, maintenance_discount_percentage, parts_discount_percentage,
  waiting_period_days, priority_level, has_preventive_maintenance, preventive_maintenance_interval_months,
  has_replacement_printer, icon_name, badge_text
) VALUES 
(
  'basic', 
  'الباقة الأساسية', 
  'Starter', 
  'حماية أساسية لطابعتك مع دعم فني وخصومات محدودة', 
  'Basic protection with technical support and limited discounts',
  15000,
  '["دعم فني وإرشاد عبر واتساب والإيميل", "فحص دوري واحد كل 6 أشهر", "خصم 10% على أجور الصيانة", "خصم 5% على قطع الغيار الأساسية", "حد أقصى: طلب خدمة واحد شهرياً"]'::jsonb,
  1, true,
  1, 10, 5, 30, 1, false, NULL, false, 'shield', NULL
),
(
  'standard', 
  'الباقة المتوسطة', 
  'Plus', 
  'حماية متقدمة مع أولوية في الخدمة وصيانة وقائية', 
  'Advanced protection with priority service and preventive maintenance',
  25000,
  '["جميع مزايا الباقة الأساسية", "أولوية في جدولة المواعيد", "خصم 15% على أجور الصيانة", "خصم 10% على قطع الغيار", "صيانة وقائية كل 3 أشهر", "حد أقصى: طلبين خدمة شهرياً"]'::jsonb,
  2, true,
  2, 15, 10, 30, 2, true, 3, false, 'star', 'الأكثر شعبية'
),
(
  'comprehensive', 
  'الباقة الشاملة', 
  'Pro', 
  'الحماية الكاملة مع أعلى أولوية وإمكانية طابعة بديلة', 
  'Complete protection with highest priority and replacement printer option',
  40000,
  '["جميع مزايا الباقة المتوسطة", "أعلى أولوية في الخدمة", "خصم 20% على أجور الصيانة", "خصم 15% على قطع الغيار", "إمكانية توفير طابعة بديلة (حسب التوفر)", "حد أقصى: 3 طلبات خدمة شهرياً", "سقف تغطية سنوي"]'::jsonb,
  3, true,
  3, 20, 15, 30, 3, true, 2, true, 'crown', NULL
)
ON CONFLICT (plan_type) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  monthly_price = EXCLUDED.monthly_price,
  features = EXCLUDED.features,
  display_order = EXCLUDED.display_order,
  max_service_requests_per_month = EXCLUDED.max_service_requests_per_month,
  maintenance_discount_percentage = EXCLUDED.maintenance_discount_percentage,
  parts_discount_percentage = EXCLUDED.parts_discount_percentage,
  waiting_period_days = EXCLUDED.waiting_period_days,
  priority_level = EXCLUDED.priority_level,
  has_preventive_maintenance = EXCLUDED.has_preventive_maintenance,
  preventive_maintenance_interval_months = EXCLUDED.preventive_maintenance_interval_months,
  has_replacement_printer = EXCLUDED.has_replacement_printer,
  icon_name = EXCLUDED.icon_name,
  badge_text = EXCLUDED.badge_text;

-- Create function to get user's eligible printers for protection
CREATE OR REPLACE FUNCTION public.get_user_eligible_printers(p_user_id uuid)
RETURNS TABLE (
  order_item_id uuid,
  order_id uuid,
  product_id uuid,
  product_name text,
  product_name_ar text,
  serial_number text,
  delivered_at timestamp with time zone,
  is_registered boolean,
  user_printer_id uuid,
  has_active_subscription boolean,
  pending_serial_request boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oi.id as order_item_id,
    oi.order_id,
    oi.product_id,
    oi.product_name,
    oi.product_name_ar,
    oi.serial_number,
    o.delivered_at,
    (up.id IS NOT NULL) as is_registered,
    up.id as user_printer_id,
    (ps.id IS NOT NULL AND ps.status = 'active') as has_active_subscription,
    (snr.id IS NOT NULL AND snr.status = 'pending') as pending_serial_request
  FROM order_items oi
  INNER JOIN orders o ON o.id = oi.order_id
  LEFT JOIN store_printers sp ON sp.serial_number = oi.serial_number
  LEFT JOIN user_printers up ON up.store_printer_id = sp.id AND up.user_id = p_user_id
  LEFT JOIN printer_subscriptions ps ON ps.user_printer_id = up.id AND ps.status = 'active'
  LEFT JOIN serial_number_requests snr ON snr.order_item_id = oi.id AND snr.status = 'pending'
  WHERE o.user_id = p_user_id
    AND o.status = 'delivered'
    AND (
      oi.product_name_ar ILIKE '%طابع%'
      OR oi.product_name_ar ILIKE '%printer%'
      OR oi.product_name ILIKE '%printer%'
      OR oi.product_name ILIKE '%3d%'
    )
  ORDER BY o.delivered_at DESC;
END;
$$;

-- Create trigger for updated_at on serial_number_requests
CREATE OR REPLACE FUNCTION public.update_serial_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_serial_number_requests_updated_at ON public.serial_number_requests;
CREATE TRIGGER update_serial_number_requests_updated_at
  BEFORE UPDATE ON public.serial_number_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_serial_requests_updated_at();