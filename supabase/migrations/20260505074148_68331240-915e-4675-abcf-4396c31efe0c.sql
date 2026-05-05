-- ============================================================
-- 1) RESTORE deleted "بيجي" color in Esun Pla-plus as out-of-stock
-- ============================================================
UPDATE public.products
SET colors = colors || jsonb_build_array(jsonb_build_object(
  'name', 'Beige',
  'name_ar', 'بيجي',
  'hex_code', '#F5F5DC',
  'in_stock', false,
  'option_stocks', jsonb_build_object('بكرة كاملة ', 0, 'تعبئة بدون روله', 0),
  'linked_options', jsonb_build_array('بكرة كاملة ', 'تعبئة بدون روله'),
  'available_for_pre_order', true,
  'available_for_direct_sale', false,
  '_restored_note', 'Auto-restored: had historical sales but was deleted'
))
WHERE id='a7059f64-8501-48f5-8580-6f504175fd09'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(colors) AS c
    WHERE c->>'name_ar' = 'بيجي'
  );

-- ============================================================
-- 2) BACKFILL inventory_movements (one-time historical reconstruction)
-- ============================================================
-- Sales: one negative row per non-cancelled order_item
INSERT INTO public.inventory_movements (
  product_id, movement_type, quantity, color_name, option_name, stock_field, note, created_at
)
SELECT
  oi.product_id,
  'sale',
  -oi.quantity,
  oi.selected_color,
  oi.selected_option,
  'option_stocks',
  'Backfill from order_id=' || oi.order_id::text || ' status=' || o.status,
  COALESCE(o.created_at, now())
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
WHERE o.status <> 'cancelled'
  AND oi.product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.inventory_movements im
    WHERE im.product_id = oi.product_id
      AND im.movement_type = 'sale'
      AND im.note LIKE 'Backfill from order_id=' || oi.order_id::text || '%'
  );

-- Purchases: one positive row per active batch
INSERT INTO public.inventory_movements (
  product_id, movement_type, quantity, stock_field, note, created_at
)
SELECT
  pb.product_id,
  'purchase',
  pb.batch_quantity,
  'batch',
  'Backfill from batch_id=' || pb.id::text,
  pb.created_at
FROM public.product_batches pb
WHERE pb.product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.inventory_movements im
    WHERE im.movement_type = 'purchase'
      AND im.note = 'Backfill from batch_id=' || pb.id::text
  );

-- ============================================================
-- 3) TRIGGER: prevent deleting a color that has historical sales
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_product_colors_with_sales()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  removed_color text;
  sold_qty integer;
BEGIN
  IF NEW.colors IS NOT DISTINCT FROM OLD.colors THEN
    RETURN NEW;
  END IF;

  FOR removed_color IN
    SELECT (c->>'name_ar')
    FROM jsonb_array_elements(COALESCE(OLD.colors,'[]'::jsonb)) AS c
    WHERE (c->>'name_ar') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(NEW.colors,'[]'::jsonb)) AS nc
        WHERE nc->>'name_ar' = c->>'name_ar'
      )
  LOOP
    SELECT COALESCE(SUM(oi.quantity),0) INTO sold_qty
    FROM order_items oi JOIN orders o ON o.id=oi.order_id
    WHERE oi.product_id = NEW.id
      AND oi.selected_color = removed_color
      AND o.status <> 'cancelled';

    IF sold_qty > 0 THEN
      RAISE EXCEPTION 'Cannot delete color "%" — it has % historical sales. Mark out-of-stock instead.', removed_color, sold_qty
        USING ERRCODE='check_violation';
    END IF;
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protect_product_colors_with_sales ON public.products;
CREATE TRIGGER trg_protect_product_colors_with_sales
BEFORE UPDATE OF colors ON public.products
FOR EACH ROW EXECUTE FUNCTION public.protect_product_colors_with_sales();

-- ============================================================
-- 4) TRIGGER: auto-log inventory movement when order_item is created
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_log_inventory_on_order_item()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.product_id IS NULL OR NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.inventory_movements (
    product_id, movement_type, quantity, color_name, option_name, stock_field, note
  ) VALUES (
    NEW.product_id, 'sale', -NEW.quantity, NEW.selected_color, NEW.selected_option,
    'option_stocks', 'Auto from order_item_id=' || NEW.id::text
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_log_inventory_on_order_item ON public.order_items;
CREATE TRIGGER trg_auto_log_inventory_on_order_item
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.auto_log_inventory_on_order_item();

-- ============================================================
-- 5) Audit function: returns products with stock discrepancies
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_product_stock_discrepancies()
RETURNS TABLE (
  product_id uuid,
  product_name text,
  recorded_sold_count integer,
  actual_sold_qty bigint,
  total_purchased bigint,
  current_total_stock bigint,
  expected_remaining bigint,
  shortfall bigint,
  missing_colors text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH sales AS (
  SELECT oi.product_id, SUM(oi.quantity) AS qty,
         array_agg(DISTINCT oi.selected_color) FILTER (WHERE oi.selected_color IS NOT NULL) AS sold_colors
  FROM order_items oi JOIN orders o ON o.id=oi.order_id
  WHERE o.status<>'cancelled' AND oi.product_id IS NOT NULL
  GROUP BY oi.product_id
),
purchases AS (
  SELECT product_id, SUM(batch_quantity) AS qty
  FROM product_batches WHERE product_id IS NOT NULL GROUP BY product_id
),
current_stock AS (
  SELECT p.id AS product_id,
         COALESCE(SUM((opt.value)::int),0) AS total
  FROM products p
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.colors,'[]'::jsonb)) AS c
  CROSS JOIN LATERAL jsonb_each_text(COALESCE(c->'option_stocks','{}'::jsonb)) AS opt
  GROUP BY p.id
),
current_colors AS (
  SELECT p.id AS product_id,
         array_agg(c->>'name_ar') AS names
  FROM products p
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.colors,'[]'::jsonb)) AS c
  GROUP BY p.id
)
SELECT
  p.id,
  p.name,
  p.sold_count,
  COALESCE(s.qty,0),
  COALESCE(pu.qty,0),
  COALESCE(cs.total,0),
  COALESCE(pu.qty,0) - COALESCE(s.qty,0) AS expected_remaining,
  (COALESCE(s.qty,0) + COALESCE(cs.total,0)) - COALESCE(pu.qty,0) AS shortfall,
  COALESCE(
    (SELECT array_agg(c) FROM unnest(s.sold_colors) AS c
     WHERE c IS NOT NULL AND NOT (c = ANY(COALESCE(cc.names, ARRAY[]::text[])))),
    ARRAY[]::text[]
  ) AS missing_colors
FROM products p
LEFT JOIN sales s ON s.product_id = p.id
LEFT JOIN purchases pu ON pu.product_id = p.id
LEFT JOIN current_stock cs ON cs.product_id = p.id
LEFT JOIN current_colors cc ON cc.product_id = p.id
WHERE COALESCE(s.qty,0) > 0
  AND (
    p.sold_count <> COALESCE(s.qty,0)
    OR (COALESCE(s.qty,0) + COALESCE(cs.total,0)) > COALESCE(pu.qty,0)
    OR EXISTS (
      SELECT 1 FROM unnest(s.sold_colors) AS sc
      WHERE sc IS NOT NULL AND NOT (sc = ANY(COALESCE(cc.names, ARRAY[]::text[])))
    )
  )
ORDER BY shortfall DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.audit_product_stock_discrepancies() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_product_stock_discrepancies() TO authenticated;