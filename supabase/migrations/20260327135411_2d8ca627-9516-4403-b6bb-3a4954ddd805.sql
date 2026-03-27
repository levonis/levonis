
-- 1. Maintenance Tickets table
CREATE TABLE public.maintenance_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.printer_subscriptions(id) ON DELETE SET NULL,
  user_printer_id UUID REFERENCES public.user_printers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  assigned_engineer_name TEXT,
  assigned_engineer_id TEXT,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets" ON public.maintenance_tickets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tickets" ON public.maintenance_tickets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tickets" ON public.maintenance_tickets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Engineer Ratings table
CREATE TABLE public.engineer_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  engineer_name TEXT NOT NULL,
  engineer_id TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ticket_id)
);

ALTER TABLE public.engineer_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ratings" ON public.engineer_ratings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own ratings" ON public.engineer_ratings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all ratings" ON public.engineer_ratings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Filament discount usage tracking
CREATE TABLE public.filament_discount_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.printer_subscriptions(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  week_start DATE NOT NULL,
  product_id UUID,
  discount_amount NUMERIC DEFAULT 0
);

ALTER TABLE public.filament_discount_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own filament usage" ON public.filament_discount_usage
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own filament usage" ON public.filament_discount_usage
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage filament usage" ON public.filament_discount_usage
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add filament_discount_percentage to protection_plans if not exists
ALTER TABLE public.protection_plans ADD COLUMN IF NOT EXISTS filament_discount_percentage INTEGER DEFAULT 0;
ALTER TABLE public.protection_plans ADD COLUMN IF NOT EXISTS filament_weekly_limit INTEGER DEFAULT 1;

-- Add warranty_duration_months to protection_plans for base warranty
ALTER TABLE public.protection_plans ADD COLUMN IF NOT EXISTS warranty_duration_months INTEGER DEFAULT 6;
