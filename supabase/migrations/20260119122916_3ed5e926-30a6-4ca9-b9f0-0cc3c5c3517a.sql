
-- Change card discount from single to multiple (JSON array)
-- First drop the foreign key constraint
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_card_discount_level_id_fkey;

-- Drop old columns
ALTER TABLE public.products DROP COLUMN IF EXISTS card_discount_level_id;
ALTER TABLE public.products DROP COLUMN IF EXISTS card_discount_percentage;

-- Add new JSON column for multiple card discounts
-- Format: [{ "level_id": "uuid", "discount_percentage": 5 }, ...]
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS card_discounts JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.products.card_discounts IS 'Array of card discounts: [{ "level_id": "uuid", "discount_percentage": number }]';
