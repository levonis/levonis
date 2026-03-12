-- Allow cart items to store exactly one source: product, custom request, or bundle
ALTER TABLE public.cart_items
DROP CONSTRAINT IF EXISTS check_product_or_custom_request;

ALTER TABLE public.cart_items
ADD CONSTRAINT check_product_custom_or_bundle
CHECK (
  (
    product_id IS NOT NULL
    AND custom_request_id IS NULL
    AND bundle_id IS NULL
  )
  OR (
    product_id IS NULL
    AND custom_request_id IS NOT NULL
    AND bundle_id IS NULL
  )
  OR (
    product_id IS NULL
    AND custom_request_id IS NULL
    AND bundle_id IS NOT NULL
  )
);