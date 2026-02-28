
-- Add sold_count column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sold_count integer NOT NULL DEFAULT 0;

-- Function to recalculate sold_count for a product
CREATE OR REPLACE FUNCTION public.update_product_sold_count()
RETURNS TRIGGER AS $$
DECLARE
  affected_product_ids uuid[];
BEGIN
  -- When order status changes to confirmed/delivered, update sold counts
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get product IDs from this order's items
    SELECT ARRAY_AGG(DISTINCT oi.product_id) INTO affected_product_ids
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id IS NOT NULL;

    IF affected_product_ids IS NOT NULL THEN
      UPDATE public.products p
      SET sold_count = COALESCE((
        SELECT SUM(oi.quantity)
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        WHERE oi.product_id = p.id
          AND o.status IN ('confirmed', 'arrived_warehouse', 'shipped', 'arrived_iraq', 'delivered')
      ), 0)
      WHERE p.id = ANY(affected_product_ids);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on orders table
DROP TRIGGER IF EXISTS trg_update_product_sold_count ON public.orders;
CREATE TRIGGER trg_update_product_sold_count
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_product_sold_count();

-- Backfill existing sold counts
UPDATE public.products p
SET sold_count = COALESCE((
  SELECT SUM(oi.quantity)
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.product_id = p.id
    AND o.status IN ('confirmed', 'arrived_warehouse', 'shipped', 'arrived_iraq', 'delivered')
), 0);
