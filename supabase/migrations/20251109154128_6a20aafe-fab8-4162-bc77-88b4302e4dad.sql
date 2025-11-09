-- Ensure relationships exist for nested selects
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_user_id_fkey_profiles'
  ) THEN
    ALTER TABLE public.orders
    ADD CONSTRAINT orders_user_id_fkey_profiles
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_order_id_fkey_orders'
  ) THEN
    ALTER TABLE public.order_items
    ADD CONSTRAINT order_items_order_id_fkey_orders
    FOREIGN KEY (order_id)
    REFERENCES public.orders(id)
    ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_product_id_fkey_products'
  ) THEN
    ALTER TABLE public.order_items
    ADD CONSTRAINT order_items_product_id_fkey_products
    FOREIGN KEY (product_id)
    REFERENCES public.products(id)
    ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_product_option_id_fkey_product_options'
  ) THEN
    ALTER TABLE public.order_items
    ADD CONSTRAINT order_items_product_option_id_fkey_product_options
    FOREIGN KEY (product_option_id)
    REFERENCES public.product_options(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure admin can select profiles via security definer has_role
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));