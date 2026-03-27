
-- Add new columns to protection_plans for granular discount configuration
ALTER TABLE public.protection_plans 
  ADD COLUMN IF NOT EXISTS parts_discount_type text DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS parts_discount_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parts_discount_limit_type text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS parts_discount_limit_count integer DEFAULT 1;

-- Create usage tracking table for plan discounts
CREATE TABLE IF NOT EXISTS public.plan_discount_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.printer_subscriptions(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES public.protection_plans(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_amount numeric NOT NULL DEFAULT 0,
  used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plan_discount_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own discount usage
CREATE POLICY "Users can view own discount usage"
  ON public.plan_discount_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own discount usage
CREATE POLICY "Users can insert own discount usage"
  ON public.plan_discount_usage FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can view all
CREATE POLICY "Admins can manage discount usage"
  ON public.plan_discount_usage FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_plan_discount_usage_user_date ON public.plan_discount_usage(user_id, used_at);
CREATE INDEX IF NOT EXISTS idx_plan_discount_usage_subscription ON public.plan_discount_usage(subscription_id);
