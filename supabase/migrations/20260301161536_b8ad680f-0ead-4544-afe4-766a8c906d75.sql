
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Recreate set_wallet_pin to use extensions.gen_salt and extensions.crypt
CREATE OR REPLACE FUNCTION public.set_wallet_pin(pin_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_wallets 
  SET pin_hash = extensions.crypt(pin_code, extensions.gen_salt('bf'))
  WHERE user_id = auth.uid();
END;
$$;

-- Recreate verify_wallet_pin to use extensions.crypt
CREATE OR REPLACE FUNCTION public.verify_wallet_pin(pin_code TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT pin_hash INTO stored_hash 
  FROM user_wallets 
  WHERE user_id = auth.uid();
  
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN stored_hash = extensions.crypt(pin_code, stored_hash);
END;
$$;
