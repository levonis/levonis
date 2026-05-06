
-- Function to permanently delete cancelled orders older than 90 days
CREATE OR REPLACE FUNCTION public.purge_old_cancelled_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
  ids uuid[];
BEGIN
  SELECT array_agg(id) INTO ids
  FROM public.orders
  WHERE status = 'cancelled'
    AND COALESCE(updated_at, created_at) < (now() - interval '90 days');

  IF ids IS NULL OR array_length(ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Remove dependent rows first (best-effort; ignore tables that don't exist)
  BEGIN DELETE FROM public.order_items WHERE order_id = ANY(ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.random_filament_orders WHERE order_id = ANY(ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.saved_invoices WHERE order_id = ANY(ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.order_status_history WHERE order_id = ANY(ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.order_tracking WHERE order_id = ANY(ids); EXCEPTION WHEN undefined_table THEN NULL; END;

  DELETE FROM public.orders WHERE id = ANY(ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Ensure pg_cron extension is available
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule previous job if exists, then schedule daily at 03:00 UTC
DO $$
BEGIN
  PERFORM cron.unschedule('purge-old-cancelled-orders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'purge-old-cancelled-orders',
  '0 3 * * *',
  $$ SELECT public.purge_old_cancelled_orders(); $$
);
