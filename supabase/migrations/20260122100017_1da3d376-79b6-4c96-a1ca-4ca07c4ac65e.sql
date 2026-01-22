-- Fix database linter: ensure views run with invoker privileges

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name = 'order_items_for_serial'
  ) THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW public.order_items_for_serial
      WITH (security_invoker = true)
      AS
      SELECT oi.id AS order_item_id,
             oi.order_id,
             oi.product_id,
             oi.product_name,
             oi.product_name_ar,
             oi.quantity,
             o.order_number,
             o.status AS order_status,
             o.user_id,
             sp.id AS store_printer_id,
             sp.serial_number,
             sp.model_name,
             sp.model_name_ar AS printer_model_ar
      FROM public.order_items oi
      JOIN public.orders o ON oi.order_id = o.id
      LEFT JOIN public.store_printers sp ON sp.order_item_id = oi.id;
    $view$;
  END IF;
END $do$;