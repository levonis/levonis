CREATE OR REPLACE FUNCTION public.compute_cod_fee_from_settings(_subtotal numeric)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
  tier jsonb;
  default_type text;
  default_value numeric;
  matched_type text;
  matched_value numeric;
  fee numeric := 0;
BEGIN
  IF _subtotal IS NULL OR _subtotal <= 0 THEN
    RETURN 0;
  END IF;

  SELECT setting_value INTO v
  FROM public.default_settings
  WHERE setting_key = 'partial_payment_settings'
  LIMIT 1;

  IF v IS NULL THEN RETURN 0; END IF;

  default_type  := COALESCE(v->>'cod_default_fee_type', 'percentage');
  default_value := COALESCE((v->>'cod_default_fee_value')::numeric, 0);

  IF jsonb_typeof(v->'fee_tiers') = 'array' THEN
    FOR tier IN SELECT * FROM jsonb_array_elements(v->'fee_tiers')
    LOOP
      IF _subtotal >= COALESCE((tier->>'min_amount')::numeric, 0)
         AND _subtotal <= COALESCE((tier->>'max_amount')::numeric, 1e18) THEN
        matched_type  := COALESCE(tier->>'cod_fee_type', default_type);
        matched_value := COALESCE((tier->>'cod_fee_value')::numeric, default_value);
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF matched_type IS NULL THEN
    matched_type := default_type;
    matched_value := default_value;
  END IF;

  IF matched_type = 'fixed' THEN
    fee := matched_value;
  ELSE
    fee := round(_subtotal * matched_value / 100.0);
  END IF;

  IF fee > 0 THEN
    fee := round(fee / 250.0) * 250;
  END IF;

  RETURN COALESCE(fee, 0);
END;
$$;

-- Backfill (bypass price-manipulation trigger which requires auth.uid())
ALTER TABLE public.orders DISABLE TRIGGER prevent_order_price_change;

WITH targets AS (
  SELECT id, public.compute_cod_fee_from_settings(subtotal) AS new_fee
  FROM public.orders
  WHERE payment_method = 'cod' AND COALESCE(cod_fee, 0) = 0
)
UPDATE public.orders o
SET cod_fee          = t.new_fee,
    total_amount     = COALESCE(o.total_amount, 0)     + t.new_fee,
    remaining_amount = COALESCE(o.remaining_amount, 0) + t.new_fee,
    profit_amount    = COALESCE(o.profit_amount, 0)    + t.new_fee
FROM targets t
WHERE o.id = t.id AND t.new_fee > 0;

ALTER TABLE public.orders ENABLE TRIGGER prevent_order_price_change;

-- Safety trigger for future inserts
CREATE OR REPLACE FUNCTION public.ensure_cod_fee_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  computed numeric;
BEGIN
  IF NEW.payment_method = 'cod' AND COALESCE(NEW.cod_fee, 0) = 0 THEN
    computed := public.compute_cod_fee_from_settings(COALESCE(NEW.subtotal, 0));
    IF computed > 0 THEN
      NEW.cod_fee          := computed;
      NEW.total_amount     := COALESCE(NEW.total_amount, 0)     + computed;
      NEW.remaining_amount := COALESCE(NEW.remaining_amount, 0) + computed;
      NEW.profit_amount    := COALESCE(NEW.profit_amount, 0)    + computed;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_cod_fee_on_insert ON public.orders;
CREATE TRIGGER trg_ensure_cod_fee_on_insert
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.ensure_cod_fee_on_insert();