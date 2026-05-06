-- 1) Reveal on payment for ALL sale types (was: only 'preorder')
CREATE OR REPLACE FUNCTION public.auto_reveal_rf_on_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND COALESCE(OLD.payment_status,'') <> 'paid' THEN
    PERFORM public.finalize_and_reveal_rf_for_order(NEW.id, NULL);
  END IF;
  RETURN NEW;
END $$;

-- 2) Reveal on order confirm for COD direct-sale RF (so stock is deducted at confirm)
CREATE OR REPLACE FUNCTION public.auto_reveal_rf_on_confirm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'confirmed' AND COALESCE(OLD.status,'') <> 'confirmed' THEN
    PERFORM public.finalize_and_reveal_rf_for_order(NEW.id, 'direct');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_reveal_rf_on_confirm ON public.orders;
CREATE TRIGGER trg_auto_reveal_rf_on_confirm
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.auto_reveal_rf_on_confirm();

-- 3) Backfill: finalize stuck paid/confirmed RF orders that have no rfo rows yet
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT o.id
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE oi.rf_offer_id IS NOT NULL
      AND (o.payment_status = 'paid' OR o.status = 'confirmed' OR o.status = 'delivered' OR o.user_confirmed_delivery = true)
      AND NOT EXISTS (
        SELECT 1 FROM public.random_filament_orders rfo
        WHERE rfo.order_id = o.id AND rfo.offer_id = oi.rf_offer_id
      )
  LOOP
    BEGIN
      PERFORM public.finalize_and_reveal_rf_for_order(r.id, NULL);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped order %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;