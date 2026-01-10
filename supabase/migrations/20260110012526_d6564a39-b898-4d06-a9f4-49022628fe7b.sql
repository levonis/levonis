-- Drop the existing status check constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add the new status check constraint that includes 'on_the_way'
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'confirmed', 'processing', 'purchased', 'shipped', 'arrived_warehouse', 'arrived_iraq', 'on_the_way', 'delivered', 'cancelled'));