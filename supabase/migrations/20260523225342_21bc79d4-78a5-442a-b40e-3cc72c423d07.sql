-- Restore SELECT on cod_fee to authenticated users.
-- cod_fee is a customer-facing fee (Cash on Delivery fee shown in invoice),
-- not an internal cost. It was accidentally revoked alongside true cost columns.
GRANT SELECT (cod_fee) ON public.orders TO authenticated;