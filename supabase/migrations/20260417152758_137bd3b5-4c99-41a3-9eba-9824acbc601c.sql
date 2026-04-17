-- Backfill owner_earnings_iqd for referral usages where it's 0 but products have referral_earnings_iqd
UPDATE public.referral_coupon_usages u
   SET owner_earnings_iqd = computed.total
  FROM (
    SELECT oi.order_id,
           COALESCE(SUM(p.referral_earnings_iqd * oi.quantity), 0) AS total
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
     GROUP BY oi.order_id
  ) computed
 WHERE u.order_id = computed.order_id
   AND COALESCE(u.owner_earnings_iqd, 0) = 0
   AND computed.total > 0;