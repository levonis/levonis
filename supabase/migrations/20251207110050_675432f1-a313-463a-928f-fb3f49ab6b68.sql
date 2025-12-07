-- Add admin financial fields to orders (not visible to customers)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS admin_product_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS admin_shipping_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS admin_other_costs numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS financial_notes text;

-- Add comment to clarify these are admin-only fields
COMMENT ON COLUMN public.orders.admin_product_cost IS 'تكلفة المنتج للإدارة - لا يظهر للزبون';
COMMENT ON COLUMN public.orders.admin_shipping_cost IS 'تكلفة الشحن الفعلية - لا يظهر للزبون';
COMMENT ON COLUMN public.orders.admin_other_costs IS 'تكاليف أخرى - لا يظهر للزبون';
COMMENT ON COLUMN public.orders.profit_amount IS 'صافي الربح - لا يظهر للزبون';
COMMENT ON COLUMN public.orders.financial_notes IS 'ملاحظات مالية - لا يظهر للزبون';