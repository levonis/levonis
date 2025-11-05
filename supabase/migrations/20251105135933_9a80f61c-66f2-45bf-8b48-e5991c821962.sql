-- Add code column to custom_product_requests table
ALTER TABLE custom_product_requests 
ADD COLUMN IF NOT EXISTS code TEXT UNIQUE DEFAULT NULL;

-- Create function to generate unique request code
CREATE OR REPLACE FUNCTION generate_request_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate code in format: REQ-XXXXXX (6 random uppercase letters and numbers)
    new_code := 'REQ-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM custom_product_requests WHERE code = new_code) INTO code_exists;
    
    -- If unique, exit loop
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate code for new requests
CREATE OR REPLACE FUNCTION set_request_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := generate_request_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_request_code ON custom_product_requests;
CREATE TRIGGER trigger_set_request_code
  BEFORE INSERT ON custom_product_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_request_code();

-- Update existing requests with unique codes
UPDATE custom_product_requests 
SET code = generate_request_code()
WHERE code IS NULL;