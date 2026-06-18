GRANT SELECT, INSERT, UPDATE, DELETE ON public.products_admin TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders_admin TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items_admin TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_offers_admin TO authenticated;
GRANT ALL ON public.products_admin TO service_role;
GRANT ALL ON public.orders_admin TO service_role;
GRANT ALL ON public.order_items_admin TO service_role;
GRANT ALL ON public.product_offers_admin TO service_role;