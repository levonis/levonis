
ALTER TABLE public.protection_plans
  ADD COLUMN IF NOT EXISTS is_addon_insurance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coverage_months integer,
  ADD COLUMN IF NOT EXISTS price_percentage numeric(6,2),
  ADD COLUMN IF NOT EXISTS requires_active_card boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS eligible_category_ids uuid[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS info_description_ar text,
  ADD COLUMN IF NOT EXISTS info_description_en text,
  ADD COLUMN IF NOT EXISTS info_description_ku text,
  ADD COLUMN IF NOT EXISTS min_price_iqd numeric,
  ADD COLUMN IF NOT EXISTS max_price_iqd numeric,
  ADD COLUMN IF NOT EXISTS name_ku text;

CREATE TABLE IF NOT EXISTS public.cart_insurance_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cart_item_id uuid NOT NULL REFERENCES public.cart_items(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.protection_plans(id) ON DELETE RESTRICT,
  printer_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  coverage_months integer NOT NULL,
  price_iqd numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cart_insurance_addons_cart_item_unique UNIQUE (cart_item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_insurance_addons TO authenticated;
GRANT ALL ON public.cart_insurance_addons TO service_role;

ALTER TABLE public.cart_insurance_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their cart insurance addons"
  ON public.cart_insurance_addons
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS cart_insurance_addons_user_idx ON public.cart_insurance_addons(user_id);
CREATE INDEX IF NOT EXISTS cart_insurance_addons_cart_item_idx ON public.cart_insurance_addons(cart_item_id);

CREATE TRIGGER set_cart_insurance_addons_updated_at
  BEFORE UPDATE ON public.cart_insurance_addons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
