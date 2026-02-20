-- Add reply_to_id column to listing_messages for reply-to-message feature
ALTER TABLE public.listing_messages 
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.listing_messages(id) ON DELETE SET NULL;

-- Create index for faster reply lookups
CREATE INDEX IF NOT EXISTS idx_listing_messages_reply_to_id ON public.listing_messages(reply_to_id);
