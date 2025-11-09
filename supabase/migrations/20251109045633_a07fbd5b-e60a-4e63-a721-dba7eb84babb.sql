-- Create triggers for order notifications and points
-- Safely drop if exist then recreate
DROP TRIGGER IF EXISTS notify_admins_new_order_trigger ON public.orders;
CREATE TRIGGER notify_admins_new_order_trigger
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_order();

DROP TRIGGER IF EXISTS notify_order_status_change_trigger ON public.orders;
CREATE TRIGGER notify_order_status_change_trigger
AFTER UPDATE OF status, tracking_number ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_change();

DROP TRIGGER IF EXISTS award_points_on_delivery_trigger ON public.orders;
CREATE TRIGGER award_points_on_delivery_trigger
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.award_points_on_delivery();