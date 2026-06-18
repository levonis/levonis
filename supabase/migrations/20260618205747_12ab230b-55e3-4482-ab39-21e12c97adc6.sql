
-- Restore missing Data API GRANTs on orders and order_items so regular users can read their own orders via PostgREST.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

-- Re-apply column-level revokes for cost/profit fields (admins read these via orders_admin/order_items_admin views).
REVOKE SELECT (admin_product_cost, admin_shipping_cost, admin_other_costs, profit_amount, financial_notes, internal_notes)
  ON public.orders FROM authenticated;
REVOKE UPDATE (admin_product_cost, admin_shipping_cost, admin_other_costs, profit_amount, financial_notes, internal_notes)
  ON public.orders FROM authenticated;

REVOKE SELECT (cost_price) ON public.order_items FROM authenticated;
REVOKE UPDATE (cost_price) ON public.order_items FROM authenticated;
