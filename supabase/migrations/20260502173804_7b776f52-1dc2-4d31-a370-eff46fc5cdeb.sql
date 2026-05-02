-- Build a reusable current-price calculator for price protection claims
CREATE OR REPLACE FUNCTION public.get_price_protection_current_price(p_order_item_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  v_label TEXT;
  v_current_price NUMERIC;
  v_used_route_price BOOLEAN := false;
BEGIN
  SELECT
    oi.id,
    oi.unit_price,
    oi.product_option_id,
    oi.shipping_option_name_ar,
    oi.selected_option,
    oi.shipping_price_adjustment,
    o.order_type,
    p.price,
    p.direct_sale_price,
    p.sea_price,
    p.air_price,
    p.shipping_type,
    p.round_up_price,
    po.price_adjustment AS option_price_adjustment
  INTO rec
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  JOIN public.products p ON p.id = oi.product_id
  LEFT JOIN public.product_options po ON po.id = oi.product_option_id
  WHERE oi.id = p_order_item_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_label := lower(coalesce(rec.shipping_option_name_ar, '') || ' ' || coalesce(rec.selected_option, ''));

  IF rec.order_type = 'direct' OR (rec.order_type IS NULL AND v_label ~ '(مخزون|stock|direct)') THEN
    IF rec.direct_sale_price IS NOT NULL THEN
      v_current_price := rec.direct_sale_price;
      v_used_route_price := true;
    ELSE
      v_current_price := rec.price;
    END IF;
  ELSE
    IF v_label ~ '(جوي|air)' THEN
      IF rec.air_price IS NOT NULL THEN
        v_current_price := rec.air_price;
        v_used_route_price := true;
      ELSE
        v_current_price := rec.price;
      END IF;
    ELSIF v_label ~ '(بحري|sea)' THEN
      IF rec.sea_price IS NOT NULL THEN
        v_current_price := rec.sea_price;
        v_used_route_price := true;
      ELSE
        v_current_price := rec.price;
      END IF;
    ELSIF rec.shipping_type = 'air' THEN
      IF rec.air_price IS NOT NULL THEN
        v_current_price := rec.air_price;
        v_used_route_price := true;
      ELSE
        v_current_price := rec.price;
      END IF;
    ELSIF rec.shipping_type = 'sea' THEN
      IF rec.sea_price IS NOT NULL THEN
        v_current_price := rec.sea_price;
        v_used_route_price := true;
      ELSE
        v_current_price := rec.price;
      END IF;
    ELSIF rec.shipping_type = 'both' THEN
      IF rec.sea_price IS NOT NULL AND rec.air_price IS NOT NULL THEN
        v_current_price := LEAST(rec.sea_price, rec.air_price);
        v_used_route_price := true;
      ELSIF rec.sea_price IS NOT NULL THEN
        v_current_price := rec.sea_price;
        v_used_route_price := true;
      ELSIF rec.air_price IS NOT NULL THEN
        v_current_price := rec.air_price;
        v_used_route_price := true;
      ELSE
        v_current_price := rec.price;
      END IF;
    ELSE
      v_current_price := rec.price;
    END IF;
  END IF;

  IF v_current_price IS NULL THEN
    RETURN NULL;
  END IF;

  -- Product option adjustments are stored in IQD and must be added directly.
  v_current_price := v_current_price + COALESCE(rec.option_price_adjustment, 0);

  -- If no route-specific stored price exists, preserve the selected preorder route adjustment.
  IF NOT v_used_route_price THEN
    v_current_price := v_current_price + COALESCE(rec.shipping_price_adjustment, 0);
  END IF;

  IF COALESCE(rec.round_up_price, false) THEN
    v_current_price := CEIL(v_current_price / 250.0) * 250;
  END IF;

  RETURN GREATEST(0, v_current_price);
END;
$function$;

-- Recalculate detection using the route-specific current price instead of a single base price
CREATE OR REPLACE FUNCTION public.detect_price_protection_for_product(p_product_id uuid, p_new_price numeric)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  affected_count INTEGER := 0;
  rec RECORD;
  reference_date TIMESTAMPTZ;
  current_price NUMERIC;
BEGIN
  FOR rec IN
    SELECT
      oi.id AS oi_id,
      oi.order_id,
      oi.product_id,
      oi.product_name_ar,
      oi.unit_price,
      oi.quantity,
      o.user_id,
      o.order_number,
      o.confirmed_at,
      o.delivered_at,
      o.user_confirmed_at,
      o.user_confirmed_delivery,
      o.status,
      p.image_url
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE oi.product_id = p_product_id
      AND o.status IN ('confirmed','processing','shipped','arrived_warehouse','arrived_iraq','on_the_way','purchased','delivered')
      AND (COALESCE(o.user_confirmed_delivery, false) = true OR o.confirmed_at IS NOT NULL)
  LOOP
    reference_date := COALESCE(rec.user_confirmed_at, rec.delivered_at, rec.confirmed_at);
    IF reference_date IS NULL THEN CONTINUE; END IF;
    IF reference_date < (now() - INTERVAL '7 days') THEN CONTINUE; END IF;

    current_price := public.get_price_protection_current_price(rec.oi_id);
    IF current_price IS NULL OR current_price <= 0 THEN CONTINUE; END IF;
    IF rec.unit_price <= current_price THEN CONTINUE; END IF;

    INSERT INTO public.price_protection_claims (
      user_id, order_id, order_item_id, product_id,
      product_name_ar, product_image, order_number,
      purchase_date, old_price, new_price, price_difference,
      quantity, total_refund, status
    ) VALUES (
      rec.user_id, rec.order_id, rec.oi_id, rec.product_id,
      rec.product_name_ar, rec.image_url, rec.order_number,
      reference_date, rec.unit_price, current_price, (rec.unit_price - current_price),
      rec.quantity, (rec.unit_price - current_price) * rec.quantity, 'pending'
    )
    ON CONFLICT (order_item_id) DO UPDATE SET
      product_name_ar = EXCLUDED.product_name_ar,
      product_image = EXCLUDED.product_image,
      order_number = EXCLUDED.order_number,
      purchase_date = EXCLUDED.purchase_date,
      old_price = EXCLUDED.old_price,
      new_price = EXCLUDED.new_price,
      price_difference = EXCLUDED.price_difference,
      quantity = EXCLUDED.quantity,
      total_refund = EXCLUDED.total_refund,
      updated_at = now()
    WHERE public.price_protection_claims.status IN ('pending', 'awaiting_admin')
      AND EXCLUDED.total_refund > public.price_protection_claims.total_refund;

    IF FOUND THEN affected_count := affected_count + 1; END IF;
  END LOOP;

  RETURN affected_count;
END;
$function$;

-- Trigger on all product price columns that can affect customer-facing prices
CREATE OR REPLACE FUNCTION public.trg_product_price_drop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.price IS DISTINCT FROM OLD.price AND NEW.price < OLD.price)
    OR (NEW.direct_sale_price IS DISTINCT FROM OLD.direct_sale_price AND NEW.direct_sale_price < OLD.direct_sale_price)
    OR (NEW.sea_price IS DISTINCT FROM OLD.sea_price AND NEW.sea_price < OLD.sea_price)
    OR (NEW.air_price IS DISTINCT FROM OLD.air_price AND NEW.air_price < OLD.air_price)
  THEN
    PERFORM public.detect_price_protection_for_product(NEW.id, NEW.price);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_products_price_drop ON public.products;
CREATE TRIGGER trg_products_price_drop
AFTER UPDATE OF price, direct_sale_price, sea_price, air_price ON public.products
FOR EACH ROW EXECUTE FUNCTION public.trg_product_price_drop();

-- Remove or correct invalid unprocessed claims created by the old base-price logic
WITH recalculated AS (
  SELECT
    c.id,
    oi.unit_price,
    oi.quantity,
    o.status AS order_status,
    COALESCE(o.user_confirmed_delivery, false) AS user_confirmed_delivery,
    o.confirmed_at,
    COALESCE(o.user_confirmed_at, o.delivered_at, o.confirmed_at) AS reference_date,
    public.get_price_protection_current_price(c.order_item_id) AS current_price
  FROM public.price_protection_claims c
  JOIN public.order_items oi ON oi.id = c.order_item_id
  JOIN public.orders o ON o.id = c.order_id
  WHERE c.status IN ('pending', 'awaiting_admin')
), invalid_claims AS (
  SELECT id
  FROM recalculated
  WHERE current_price IS NULL
    OR current_price <= 0
    OR unit_price <= current_price
    OR order_status NOT IN ('confirmed','processing','shipped','arrived_warehouse','arrived_iraq','on_the_way','purchased','delivered')
    OR NOT (user_confirmed_delivery = true OR confirmed_at IS NOT NULL)
    OR reference_date IS NULL
    OR reference_date < (now() - INTERVAL '7 days')
)
DELETE FROM public.price_protection_claims c
USING invalid_claims i
WHERE c.id = i.id;

WITH recalculated AS (
  SELECT
    c.id,
    oi.unit_price,
    oi.quantity,
    COALESCE(o.user_confirmed_at, o.delivered_at, o.confirmed_at) AS reference_date,
    public.get_price_protection_current_price(c.order_item_id) AS current_price
  FROM public.price_protection_claims c
  JOIN public.order_items oi ON oi.id = c.order_item_id
  JOIN public.orders o ON o.id = c.order_id
  WHERE c.status IN ('pending', 'awaiting_admin')
)
UPDATE public.price_protection_claims c
SET
  purchase_date = r.reference_date,
  old_price = r.unit_price,
  new_price = r.current_price,
  price_difference = r.unit_price - r.current_price,
  quantity = r.quantity,
  total_refund = (r.unit_price - r.current_price) * r.quantity,
  updated_at = now()
FROM recalculated r
WHERE c.id = r.id
  AND r.current_price IS NOT NULL
  AND r.unit_price > r.current_price
  AND (
    c.old_price IS DISTINCT FROM r.unit_price
    OR c.new_price IS DISTINCT FROM r.current_price
    OR c.quantity IS DISTINCT FROM r.quantity
    OR c.total_refund IS DISTINCT FROM ((r.unit_price - r.current_price) * r.quantity)
  );