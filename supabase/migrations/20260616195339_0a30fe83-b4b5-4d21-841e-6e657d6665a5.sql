
-- 1. Cost fields on product_options
ALTER TABLE public.product_options
  ADD COLUMN IF NOT EXISTS cost_iqd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_usd numeric DEFAULT 0;

-- 2. Pending review flags on products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pending_admin_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by_assistant uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_pending_admin_review
  ON public.products (pending_admin_review)
  WHERE pending_admin_review = true;

-- 3. Trigger: when an assistant (not admin) inserts a product, auto-mark pending
CREATE OR REPLACE FUNCTION public.mark_assistant_product_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND public.has_role(auth.uid(), 'assistant'::app_role)
     AND NOT public.has_role(auth.uid(), 'admin'::app_role)
  THEN
    NEW.pending_admin_review := true;
    NEW.is_pricing_updated := false;
    NEW.created_by_assistant := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_assistant_product_pending ON public.products;
CREATE TRIGGER trg_mark_assistant_product_pending
BEFORE INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.mark_assistant_product_pending();

-- 4. RLS: hide pending products from the public, allow admins/assistants to see them
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
CREATE POLICY "Anyone can view non-pending products"
ON public.products
FOR SELECT
USING (
  pending_admin_review = false
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'assistant'::app_role)
);

-- 5. Allow assistants to INSERT products (currently only admins via "Only admins can manage products")
DROP POLICY IF EXISTS "Assistants can insert products" ON public.products;
CREATE POLICY "Assistants can insert products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'assistant'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
