-- Add conversation code to listing_conversations
ALTER TABLE public.listing_conversations 
ADD COLUMN IF NOT EXISTS conversation_code text UNIQUE;

-- Create function to generate unique conversation code
CREATE OR REPLACE FUNCTION generate_conversation_code()
RETURNS text AS $$
DECLARE
  code text;
  code_exists boolean;
BEGIN
  LOOP
    -- Generate a 6-character alphanumeric code
    code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    -- Check if code exists
    SELECT EXISTS(SELECT 1 FROM listing_conversations WHERE conversation_code = code) INTO code_exists;
    IF NOT code_exists THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate conversation code on insert
CREATE OR REPLACE FUNCTION set_conversation_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.conversation_code IS NULL THEN
    NEW.conversation_code := generate_conversation_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_set_conversation_code ON listing_conversations;
CREATE TRIGGER trigger_set_conversation_code
  BEFORE INSERT ON listing_conversations
  FOR EACH ROW
  EXECUTE FUNCTION set_conversation_code();

-- Update existing conversations with codes
UPDATE listing_conversations SET conversation_code = generate_conversation_code() WHERE conversation_code IS NULL;