-- Add unique constraint to prevent multiple offers per merchant per request
ALTER TABLE public.print_offers
ADD CONSTRAINT unique_offer_per_trader_per_request UNIQUE (request_id, trader_id);

-- Add auto-response settings to merchant_applications
ALTER TABLE public.merchant_applications
ADD COLUMN IF NOT EXISTS welcome_message TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS away_message TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS inquiry_template TEXT DEFAULT 'لدي عرضا لك، لكن هل يمكنك الإجابة على أسئلتي ؟',
ADD COLUMN IF NOT EXISTS is_away BOOLEAN DEFAULT FALSE;

-- Add last_context to listing_conversations to track what product/request the user entered through
ALTER TABLE public.listing_conversations
ADD COLUMN IF NOT EXISTS entry_context JSONB DEFAULT NULL;