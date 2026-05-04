
-- 1) merchant_products: require approved merchant status on INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Merchants can insert their own products" ON public.merchant_products;
DROP POLICY IF EXISTS "Merchants can update their own products" ON public.merchant_products;
DROP POLICY IF EXISTS "Merchants can delete their own products" ON public.merchant_products;

CREATE POLICY "Approved merchants can insert their own products"
ON public.merchant_products
FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT ma.user_id FROM public.merchant_applications ma
    WHERE ma.id = merchant_products.merchant_id
      AND ma.status = 'approved'
  )
);

CREATE POLICY "Approved merchants can update their own products"
ON public.merchant_products
FOR UPDATE
USING (
  auth.uid() IN (
    SELECT ma.user_id FROM public.merchant_applications ma
    WHERE ma.id = merchant_products.merchant_id
      AND ma.status = 'approved'
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT ma.user_id FROM public.merchant_applications ma
    WHERE ma.id = merchant_products.merchant_id
      AND ma.status = 'approved'
  )
);

CREATE POLICY "Approved merchants can delete their own products"
ON public.merchant_products
FOR DELETE
USING (
  auth.uid() IN (
    SELECT ma.user_id FROM public.merchant_applications ma
    WHERE ma.id = merchant_products.merchant_id
      AND ma.status = 'approved'
  )
);

-- 2) print_offers: restrict SELECT to request owner, offer trader, or admin
DROP POLICY IF EXISTS "Anyone can view offers for community requests" ON public.print_offers;

CREATE POLICY "Request owner, offer trader, or admin can view offers"
ON public.print_offers
FOR SELECT
USING (
  trader_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.community_print_requests r
    WHERE r.id = print_offers.request_id
      AND r.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
