
-- 1) Add last_price_update column
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS last_price_update timestamptz;

-- 2) Trigger function on products: bump last_price_update when price/cost-related fields change OR when is_pricing_updated transitions false->true
CREATE OR REPLACE FUNCTION public.products_track_price_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_pricing_updated IS TRUE THEN
      NEW.last_price_update := now();
    END IF;
    RETURN NEW;
  END IF;

  IF (NEW.price_usd IS DISTINCT FROM OLD.price_usd)
     OR (NEW.original_price IS DISTINCT FROM OLD.original_price)
     OR (NEW.direct_sale_price IS DISTINCT FROM OLD.direct_sale_price)
     OR (COALESCE(NEW.is_pricing_updated, false) = true
         AND COALESCE(OLD.is_pricing_updated, false) = false)
  THEN
    NEW.last_price_update := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_track_price_update ON public.products;
CREATE TRIGGER trg_products_track_price_update
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_track_price_update();

-- 3) Trigger on product_options: when option price/cost changes, bump parent product's last_price_update
CREATE OR REPLACE FUNCTION public.product_options_bump_parent_price_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    pid := OLD.product_id;
  ELSE
    pid := NEW.product_id;
  END IF;
  UPDATE public.products SET last_price_update = now() WHERE id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_product_options_bump_price_update ON public.product_options;
CREATE TRIGGER trg_product_options_bump_price_update
  AFTER INSERT OR UPDATE OF price_adjustment, cost_iqd, cost_usd OR DELETE
  ON public.product_options
  FOR EACH ROW EXECUTE FUNCTION public.product_options_bump_parent_price_update();

-- 4) Bulk reset all existing products to "needs update"
UPDATE public.products
SET is_pricing_updated = false,
    last_price_update = NULL
WHERE true;

-- 5) Auto-hide stale priced products RPC (60 day threshold)
CREATE OR REPLACE FUNCTION public.auto_hide_stale_priced_products()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.products
  SET is_pricing_updated = false
  WHERE is_pricing_updated = true
    AND last_price_update IS NOT NULL
    AND now() - last_price_update > interval '60 days';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_hide_stale_priced_products() TO service_role;

-- 6) Admin RPC for quick cost edit (atomic update of product cost + options, sets is_pricing_updated=true)
CREATE OR REPLACE FUNCTION public.admin_quick_update_costs(
  _product_id uuid,
  _product_cost numeric,
  _options jsonb -- [{id: uuid, cost: numeric}]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Update product: cost mirrors sale price; set pricing updated flag
  UPDATE public.products
  SET cost = COALESCE(_product_cost, cost),
      is_pricing_updated = true,
      last_price_update = now()
  WHERE id = _product_id;

  -- For each option, set both price_adjustment and cost_iqd to same value (cost = sale)
  IF _options IS NOT NULL THEN
    FOR o IN SELECT * FROM jsonb_array_elements(_options)
    LOOP
      UPDATE public.product_options
      SET price_adjustment = COALESCE((o->>'cost')::numeric, price_adjustment),
          cost_iqd        = COALESCE((o->>'cost')::numeric, cost_iqd)
      WHERE id = (o->>'id')::uuid
        AND product_id = _product_id;
    END LOOP;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_quick_update_costs(uuid, numeric, jsonb) TO authenticated;
