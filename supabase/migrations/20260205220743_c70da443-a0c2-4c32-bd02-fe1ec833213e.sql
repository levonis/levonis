-- Fix email_verification_codes security vulnerability
-- Remove the unsafe SELECT policy that allows users to view codes by email

-- Drop the vulnerable SELECT policy
DROP POLICY IF EXISTS "Users can view their own codes" ON email_verification_codes;

-- The table already has "Service role full access" policy which is correct
-- Verification codes should ONLY be accessible via edge functions using service role

-- Add a comment to document the security design
COMMENT ON TABLE email_verification_codes IS 'Verification codes are accessed ONLY via edge functions (send-verification-code, verify-code). Client-side access is blocked for security.';