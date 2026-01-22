-- Merchant applications (registration as merchant) for Levo Community
-- Stores merchant onboarding requests; admins can review & manage.

CREATE TABLE IF NOT EXISTS public.merchant_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  display_name text NULL,
  phone_number text NULL,
  city text NULL,
  bio text NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_applications ENABLE ROW LEVEL SECURITY;

-- Users: view their own application
CREATE POLICY "Users can view their own merchant application"
ON public.merchant_applications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users: create their own application
CREATE POLICY "Users can create their own merchant application"
ON public.merchant_applications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users: update their own application while pending/rejected only
CREATE POLICY "Users can update their own merchant application (limited)"
ON public.merchant_applications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status IN ('pending','rejected'))
WITH CHECK (auth.uid() = user_id AND status IN ('pending','rejected'));

-- Admins: full access
CREATE POLICY "Admins can manage merchant applications"
ON public.merchant_applications
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_merchant_applications_user_id ON public.merchant_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_applications_status ON public.merchant_applications(status);

-- updated_at trigger (reuse existing helper if present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_merchant_applications_updated_at'
  ) THEN
    CREATE TRIGGER update_merchant_applications_updated_at
    BEFORE UPDATE ON public.merchant_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
