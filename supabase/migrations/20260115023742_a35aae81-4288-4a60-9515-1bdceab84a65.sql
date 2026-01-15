-- Create subscription payments table for tracking payments, upgrades, and refunds
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.printer_subscriptions(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'IQD',
  payment_type TEXT NOT NULL CHECK (payment_type IN ('payment', 'upgrade', 'refund', 'cancellation_refund')),
  notes TEXT,
  old_plan_id UUID REFERENCES public.protection_plans(id),
  new_plan_id UUID REFERENCES public.protection_plans(id),
  days_remaining INTEGER,
  credit_amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add cancellation tracking columns to printer_subscriptions
ALTER TABLE public.printer_subscriptions 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS used_days INTEGER,
ADD COLUMN IF NOT EXISTS remaining_days INTEGER,
ADD COLUMN IF NOT EXISTS refund_amount NUMERIC;

-- Enable RLS on subscription_payments
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for subscription_payments
CREATE POLICY "Users can view their own payments" ON public.subscription_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payments" ON public.subscription_payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert payments" ON public.subscription_payments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Users can insert their own payments (for subscription creation)
CREATE POLICY "Users can insert own payments" ON public.subscription_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add realtime for subscription_payments
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscription_payments;