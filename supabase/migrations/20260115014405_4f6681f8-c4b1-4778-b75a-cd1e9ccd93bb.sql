
-- Create enum for subscription status
CREATE TYPE public.printer_subscription_status AS ENUM ('active', 'paused', 'expired', 'cancelled');

-- Create enum for protection plan type
CREATE TYPE public.protection_plan_type AS ENUM ('basic', 'standard', 'comprehensive');

-- Create enum for printer verification status
CREATE TYPE public.printer_verification_status AS ENUM ('pending', 'verified', 'rejected');

-- Store printers table (printers sold by the store with serial numbers)
CREATE TABLE public.store_printers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT NOT NULL,
    model_name_ar TEXT NOT NULL,
    serial_number TEXT UNIQUE NOT NULL,
    sold_at TIMESTAMP WITH TIME ZONE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    is_registered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User registered printers
CREATE TABLE public.user_printers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    store_printer_id UUID NOT NULL REFERENCES public.store_printers(id) ON DELETE CASCADE,
    verification_status printer_verification_status DEFAULT 'pending',
    verified_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(store_printer_id)
);

-- Protection plans configuration
CREATE TABLE public.protection_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_type protection_plan_type NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_ar TEXT,
    description_en TEXT,
    monthly_price NUMERIC(10,2) NOT NULL,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Printer subscriptions
CREATE TABLE public.printer_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_printer_id UUID NOT NULL REFERENCES public.user_printers(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.protection_plans(id) ON DELETE RESTRICT,
    status printer_subscription_status DEFAULT 'active',
    start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    end_date TIMESTAMP WITH TIME ZONE,
    next_billing_date TIMESTAMP WITH TIME ZONE,
    monthly_price NUMERIC(10,2) NOT NULL,
    admin_notes TEXT,
    paused_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Activity logs for printer protection system
CREATE TABLE public.printer_protection_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protection_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printer_protection_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for store_printers
CREATE POLICY "Anyone can view store printers" ON public.store_printers
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage store printers" ON public.store_printers
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_printers
CREATE POLICY "Users can view their own printers" ON public.user_printers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own printers" ON public.user_printers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own printers" ON public.user_printers
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all printers" ON public.user_printers
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all printers" ON public.user_printers
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for protection_plans
CREATE POLICY "Anyone can view active plans" ON public.protection_plans
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage plans" ON public.protection_plans
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for printer_subscriptions
CREATE POLICY "Users can view their own subscriptions" ON public.printer_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions" ON public.printer_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions" ON public.printer_subscriptions
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all subscriptions" ON public.printer_subscriptions
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for logs
CREATE POLICY "Admins can view all logs" ON public.printer_protection_logs
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert logs" ON public.printer_protection_logs
    FOR INSERT WITH CHECK (true);

-- Insert default protection plans
INSERT INTO public.protection_plans (plan_type, name_ar, name_en, description_ar, description_en, monthly_price, features, display_order) VALUES
('basic', 'الباقة الأساسية', 'Basic Plan', 'حماية أساسية للطابعة', 'Basic printer protection', 15000, '["دعم فني عبر الهاتف", "استشارات عن بعد", "خصم 10% على قطع الغيار"]', 1),
('standard', 'الباقة المتوسطة', 'Standard Plan', 'حماية متوسطة مع مميزات إضافية', 'Standard protection with extra features', 25000, '["جميع مميزات الباقة الأساسية", "صيانة دورية كل 3 أشهر", "خصم 20% على قطع الغيار", "أولوية في الدعم الفني"]', 2),
('comprehensive', 'الباقة الشاملة', 'Comprehensive Plan', 'حماية شاملة مع تغطية كاملة', 'Full comprehensive coverage', 40000, '["جميع مميزات الباقة المتوسطة", "صيانة شهرية مجانية", "استبدال قطع الغيار مجاناً", "زيارات ميدانية غير محدودة", "ضمان ممتد"]', 3);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_printer_protection_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_store_printers_updated_at
    BEFORE UPDATE ON public.store_printers
    FOR EACH ROW EXECUTE FUNCTION public.update_printer_protection_updated_at();

CREATE TRIGGER update_user_printers_updated_at
    BEFORE UPDATE ON public.user_printers
    FOR EACH ROW EXECUTE FUNCTION public.update_printer_protection_updated_at();

CREATE TRIGGER update_protection_plans_updated_at
    BEFORE UPDATE ON public.protection_plans
    FOR EACH ROW EXECUTE FUNCTION public.update_printer_protection_updated_at();

CREATE TRIGGER update_printer_subscriptions_updated_at
    BEFORE UPDATE ON public.printer_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_printer_protection_updated_at();

-- Function to verify printer serial number
CREATE OR REPLACE FUNCTION public.verify_printer_serial(p_serial_number TEXT)
RETURNS TABLE(
    store_printer_id UUID,
    model_name TEXT,
    model_name_ar TEXT,
    is_available BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.id,
        sp.model_name,
        sp.model_name_ar,
        NOT sp.is_registered AS is_available
    FROM public.store_printers sp
    WHERE sp.serial_number = p_serial_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to register printer
CREATE OR REPLACE FUNCTION public.register_user_printer(
    p_user_id UUID,
    p_serial_number TEXT
) RETURNS UUID AS $$
DECLARE
    v_store_printer_id UUID;
    v_user_printer_id UUID;
BEGIN
    -- Check if serial exists and is not registered
    SELECT id INTO v_store_printer_id
    FROM public.store_printers
    WHERE serial_number = p_serial_number AND is_registered = FALSE;
    
    IF v_store_printer_id IS NULL THEN
        RAISE EXCEPTION 'الرقم التسلسلي غير موجود أو مسجل مسبقاً';
    END IF;
    
    -- Register the printer
    INSERT INTO public.user_printers (user_id, store_printer_id, verification_status, verified_at)
    VALUES (p_user_id, v_store_printer_id, 'verified', now())
    RETURNING id INTO v_user_printer_id;
    
    -- Mark store printer as registered
    UPDATE public.store_printers SET is_registered = TRUE WHERE id = v_store_printer_id;
    
    -- Log the action
    INSERT INTO public.printer_protection_logs (user_id, action, entity_type, entity_id, details)
    VALUES (p_user_id, 'register_printer', 'user_printer', v_user_printer_id, 
            jsonb_build_object('serial_number', p_serial_number));
    
    RETURN v_user_printer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
