-- Drop duplicate ambiguous FK causing PostgREST 300 embedding error
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'order_items_order_id_fkey_orders'
  ) THEN
    ALTER TABLE public.order_items
    DROP CONSTRAINT order_items_order_id_fkey_orders;
  END IF;
END $$;