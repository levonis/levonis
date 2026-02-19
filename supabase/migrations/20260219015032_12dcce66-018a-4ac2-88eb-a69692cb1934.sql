
-- Drop and recreate the check constraint to include all needed statuses
ALTER TABLE public.product_offer_purchases 
DROP CONSTRAINT IF EXISTS product_offer_purchases_purchase_status_check;

ALTER TABLE public.product_offer_purchases 
ADD CONSTRAINT product_offer_purchases_purchase_status_check 
CHECK (purchase_status = ANY (ARRAY['purchased'::text, 'shipping_requested'::text, 'confirmed'::text, 'shipped'::text, 'on_the_way'::text, 'delivered'::text, 'cancelled'::text]));
