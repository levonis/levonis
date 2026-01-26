-- Create community complaints table
CREATE TABLE IF NOT EXISTS public.community_complaints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complainant_id uuid NOT NULL,
    reported_user_id uuid,
    reported_merchant_id uuid,
    request_id uuid REFERENCES public.community_print_requests(id),
    offer_id uuid,
    complaint_type text NOT NULL DEFAULT 'general',
    title text NOT NULL,
    description text NOT NULL,
    images text[] DEFAULT '{}',
    status text NOT NULL DEFAULT 'pending',
    priority text DEFAULT 'normal',
    admin_notes text,
    resolution text,
    resolved_by uuid,
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.community_complaints ENABLE ROW LEVEL SECURITY;

-- Policies for complaints
CREATE POLICY "Users can view own complaints" ON public.community_complaints
    FOR SELECT USING (auth.uid() = complainant_id OR auth.uid() = reported_user_id);

CREATE POLICY "Admins can view all complaints" ON public.community_complaints
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create complaints" ON public.community_complaints
    FOR INSERT WITH CHECK (auth.uid() = complainant_id);

CREATE POLICY "Admins can update complaints" ON public.community_complaints
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Create community customer profiles table (for tracking community-specific user data)
CREATE TABLE IF NOT EXISTS public.community_customer_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    display_name text,
    bio text,
    avatar_url text,
    frame_url text,
    total_requests_made integer DEFAULT 0,
    total_requests_received integer DEFAULT 0,
    total_spent numeric(12,2) DEFAULT 0,
    reputation_score numeric(5,2) DEFAULT 0,
    is_verified boolean DEFAULT false,
    is_suspended boolean DEFAULT false,
    suspension_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.community_customer_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for customer profiles
CREATE POLICY "Anyone can view customer profiles" ON public.community_customer_profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.community_customer_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all profiles" ON public.community_customer_profiles
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Add realtime for complaints
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_complaints;

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_community_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_community_complaints_updated_at
    BEFORE UPDATE ON public.community_complaints
    FOR EACH ROW EXECUTE FUNCTION public.update_community_updated_at();

CREATE TRIGGER update_community_customer_profiles_updated_at
    BEFORE UPDATE ON public.community_customer_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_community_updated_at();