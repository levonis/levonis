
-- Hide cost/profit/commission columns from anon and authenticated roles on base tables.
-- Admins must read these via the *_admin views (which call SECURITY DEFINER functions).

-- orders: sensitive columns
REVOKE SELECT (profit_amount, admin_product_cost, admin_shipping_cost, admin_other_costs, internal_notes, financial_notes, admin_files, admin_images) ON public.orders FROM anon, authenticated;

-- order_items: cost_price
REVOKE SELECT (cost_price) ON public.order_items FROM anon, authenticated;

-- products: cost + commission + shipping cost fields
REVOKE SELECT (cost_price, commission_iqd, commission_sea_iqd, commission_air_iqd, commission_direct_iqd, other_costs_iqd, shipping_cost_iqd) ON public.products FROM anon, authenticated;

-- product_offers: cost_price
REVOKE SELECT (cost_price) ON public.product_offers FROM anon, authenticated;

-- product_options: cost_usd/cost_iqd
REVOKE SELECT (cost_usd, cost_iqd) ON public.product_options FROM anon, authenticated;

-- Fix SUPA_security_definer_view: ensure products_admin runs as security_invoker.
-- The view delegates to a SECURITY DEFINER function which still gates sensitive columns by has_role().
ALTER VIEW public.products_admin SET (security_invoker = true);

-- Make sure admins can still execute the underlying SECURITY DEFINER aggregators via the views.
GRANT EXECUTE ON FUNCTION public._admin_products_full() TO authenticated;
GRANT EXECUTE ON FUNCTION public._admin_orders_full() TO authenticated;
GRANT EXECUTE ON FUNCTION public._admin_order_items_full() TO authenticated;
GRANT EXECUTE ON FUNCTION public._admin_product_offers_full() TO authenticated;

-- Ensure admin views are selectable by authenticated (no-op if already granted).
GRANT SELECT ON public.products_admin TO authenticated;
GRANT SELECT ON public.orders_admin TO authenticated;
GRANT SELECT ON public.order_items_admin TO authenticated;
GRANT SELECT ON public.product_offers_admin TO authenticated;
