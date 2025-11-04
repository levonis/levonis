-- Add suggested_price and admin_notes to custom_product_requests
ALTER TABLE public.custom_product_requests
ADD COLUMN IF NOT EXISTS suggested_price NUMERIC,
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_custom_requests_user_id 
ON public.custom_product_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_custom_requests_status 
ON public.custom_product_requests(status);