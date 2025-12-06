-- Add shipping route waypoints column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS shipping_route_waypoints jsonb DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.orders.shipping_route_waypoints IS 'JSON array of [longitude, latitude] coordinates defining the custom shipping route';