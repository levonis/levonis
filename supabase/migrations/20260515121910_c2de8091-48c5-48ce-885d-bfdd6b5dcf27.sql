CREATE OR REPLACE FUNCTION public.get_donations_stats()
 RETURNS TABLE(total_amount numeric, total_count bigint, donor_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH valid AS (
    SELECT d.*
    FROM public.donations_log d
    LEFT JOIN public.orders o ON o.id = d.order_id
    WHERE
      -- Direct wallet donations always count
      d.source = 'wallet_direct'
      -- Order-based donations only count when the order is delivered
      OR (
        d.source IN ('order_auto','order_extra')
        AND d.order_id IS NOT NULL
        AND o.status = 'delivered'
      )
  )
  SELECT
    COALESCE(SUM(amount), 0)::numeric AS total_amount,
    COUNT(*)::bigint AS total_count,
    COUNT(DISTINCT user_id)::bigint AS donor_count
  FROM valid;
$function$;