-- Add shipping duration days field to orders
ALTER TABLE public.orders 
ADD COLUMN shipping_duration_days INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.orders.shipping_duration_days IS 'Duration of shipping in days, set manually by admin for tracking animation';