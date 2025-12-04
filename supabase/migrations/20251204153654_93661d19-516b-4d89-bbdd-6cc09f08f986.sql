-- Add shipping route type to orders
ALTER TABLE public.orders 
ADD COLUMN shipping_route_type TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.orders.shipping_route_type IS 'Type of shipping route: sea_guangzhou_umm_qasr (بحري من الصين), air_guangzhou_erbil (جوي من الصين لأربيل)';