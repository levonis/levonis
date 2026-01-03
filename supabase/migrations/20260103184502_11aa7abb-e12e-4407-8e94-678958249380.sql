-- Add options and colors columns to product_offers table
ALTER TABLE public.product_offers
ADD COLUMN IF NOT EXISTS options jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS colors jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.product_offers.options IS 'Array of product options like size, type, etc. Format: [{name_ar: string, price_adjustment: number, in_stock: boolean}]';
COMMENT ON COLUMN public.product_offers.colors IS 'Array of product colors. Format: [{name_ar: string, hex_code: string, image_url: string | null, in_stock: boolean}]';