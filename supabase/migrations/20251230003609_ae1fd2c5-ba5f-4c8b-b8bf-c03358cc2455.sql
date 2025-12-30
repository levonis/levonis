-- Create table for marketplace telegram context (for replying from telegram)
CREATE TABLE IF NOT EXISTS public.marketplace_telegram_context (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_chat_id TEXT NOT NULL,
  conversation_id UUID NOT NULL REFERENCES public.listing_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique index to ensure one context per telegram chat
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_telegram_context_chat 
  ON public.marketplace_telegram_context(telegram_chat_id);

-- Enable RLS
ALTER TABLE public.marketplace_telegram_context ENABLE ROW LEVEL SECURITY;

-- Only allow service role access (edge functions)
CREATE POLICY "Block all client access to marketplace_telegram_context"
  ON public.marketplace_telegram_context
  FOR ALL
  USING (false)
  WITH CHECK (false);