-- Add listing_code column to user_listings
ALTER TABLE public.user_listings 
ADD COLUMN IF NOT EXISTS listing_code TEXT UNIQUE;

-- Create function to generate unique listing code
CREATE OR REPLACE FUNCTION public.generate_listing_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := 'PRD-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
    SELECT EXISTS(SELECT 1 FROM user_listings WHERE listing_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$;

-- Create trigger to auto-generate listing code
CREATE OR REPLACE FUNCTION public.set_listing_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.listing_code IS NULL THEN
    NEW.listing_code := generate_listing_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_listing_code ON public.user_listings;
CREATE TRIGGER trigger_set_listing_code
  BEFORE INSERT ON public.user_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_listing_code();

-- Generate codes for existing listings that don't have one
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.user_listings WHERE listing_code IS NULL
  LOOP
    UPDATE public.user_listings 
    SET listing_code = public.generate_listing_code() 
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- Update RLS policies for listing_messages to allow admin access
DROP POLICY IF EXISTS "Admins can view all messages" ON public.listing_messages;
CREATE POLICY "Admins can view all messages"
  ON public.listing_messages
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert messages" ON public.listing_messages;
CREATE POLICY "Admins can insert messages"
  ON public.listing_messages
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add policies for participants to view and insert messages
DROP POLICY IF EXISTS "Participants can view messages" ON public.listing_messages;
CREATE POLICY "Participants can view messages"
  ON public.listing_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM listing_conversations lc
      WHERE lc.id = listing_messages.conversation_id
      AND (lc.buyer_id = auth.uid() OR lc.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can insert messages" ON public.listing_messages;
CREATE POLICY "Participants can insert messages"
  ON public.listing_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM listing_conversations lc
      WHERE lc.id = listing_messages.conversation_id
      AND (lc.buyer_id = auth.uid() OR lc.seller_id = auth.uid())
    )
  );

-- Update listing_conversations policies for admin join capability
DROP POLICY IF EXISTS "Admins can insert into conversations" ON public.listing_conversations;
CREATE POLICY "Admins can insert into conversations"
  ON public.listing_conversations
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow participants to update is_read on messages
DROP POLICY IF EXISTS "Participants can update message read status" ON public.listing_messages;
CREATE POLICY "Participants can update message read status"
  ON public.listing_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM listing_conversations lc
      WHERE lc.id = listing_messages.conversation_id
      AND (lc.buyer_id = auth.uid() OR lc.seller_id = auth.uid())
    )
  );

-- Admin can update messages
DROP POLICY IF EXISTS "Admins can update messages" ON public.listing_messages;
CREATE POLICY "Admins can update messages"
  ON public.listing_messages
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add index for faster searches
CREATE INDEX IF NOT EXISTS idx_user_listings_listing_code ON public.user_listings(listing_code);
CREATE INDEX IF NOT EXISTS idx_user_listings_status ON public.user_listings(status);
CREATE INDEX IF NOT EXISTS idx_listing_conversations_status ON public.listing_conversations(status);