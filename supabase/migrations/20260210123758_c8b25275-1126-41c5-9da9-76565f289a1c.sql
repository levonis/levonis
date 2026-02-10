
-- Create a function to set/update wallet PIN (hashed)
CREATE OR REPLACE FUNCTION public.set_wallet_pin(pin_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF length(pin_code) <> 4 OR pin_code !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 4 digits';
  END IF;
  
  UPDATE profiles 
  SET wallet_pin = crypt(pin_code, gen_salt('bf'))
  WHERE id = auth.uid();
END;
$$;

-- Create a function to verify wallet PIN
CREATE OR REPLACE FUNCTION public.verify_wallet_pin(pin_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_pin text;
BEGIN
  SELECT wallet_pin INTO stored_pin 
  FROM profiles 
  WHERE id = auth.uid();
  
  IF stored_pin IS NULL THEN
    RETURN true; -- No PIN set, allow
  END IF;
  
  RETURN stored_pin = crypt(pin_code, stored_pin);
END;
$$;

-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;
