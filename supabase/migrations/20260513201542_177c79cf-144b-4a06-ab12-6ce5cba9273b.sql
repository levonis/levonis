DROP FUNCTION IF EXISTS public.get_order_wallet_log(uuid);

CREATE OR REPLACE FUNCTION public.get_order_wallet_log(p_order_id uuid)
 RETURNS TABLE(
   id uuid,
   user_id uuid,
   amount numeric,
   balance_before numeric,
   balance_after numeric,
   breakdown jsonb,
   description text,
   status text,
   created_at timestamp with time zone,
   type text,
   payment_method text,
   idempotency_key text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT wt.id, wt.user_id, wt.amount, wt.balance_before, wt.balance_after,
         wt.breakdown, wt.admin_notes AS description, wt.status, wt.created_at,
         wt.type, wt.payment_method, wt.idempotency_key
    FROM public.wallet_transactions wt
   WHERE wt.order_id = p_order_id
     AND (
       auth.uid() = wt.user_id
       OR public.has_role(auth.uid(), 'admin'::app_role)
     )
   ORDER BY wt.created_at DESC;
$function$;