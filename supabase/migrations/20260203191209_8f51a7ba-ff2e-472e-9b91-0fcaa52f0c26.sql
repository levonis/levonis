-- Add email_verified field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified ON public.profiles(email_verified);

-- Update existing email_verification_codes table to support more types
-- The table already exists, let's just make sure it has all needed columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_verification_codes' 
                   AND column_name = 'attempts') THEN
        ALTER TABLE public.email_verification_codes 
        ADD COLUMN attempts integer DEFAULT 0;
    END IF;
END $$;

-- Create RLS policy for email_verification_codes if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_verification_codes' AND policyname = 'Users can view their own codes') THEN
        CREATE POLICY "Users can view their own codes" 
        ON public.email_verification_codes 
        FOR SELECT 
        USING (email = current_setting('request.jwt.claims', true)::json->>'email' OR user_id = auth.uid());
    END IF;
END $$;