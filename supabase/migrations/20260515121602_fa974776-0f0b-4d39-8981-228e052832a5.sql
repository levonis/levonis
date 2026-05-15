-- Prevent duplicate order-based donations even on repeated status updates or retries
-- Cleanup any existing duplicates first, keeping the earliest row per (order_id, source)
DELETE FROM public.donations_log a
USING public.donations_log b
WHERE a.order_id IS NOT NULL
  AND a.source IN ('order_auto','order_extra')
  AND a.order_id = b.order_id
  AND a.source = b.source
  AND a.created_at > b.created_at;

-- Also handle exact-tie duplicates (same created_at) by keeping smallest id
DELETE FROM public.donations_log a
USING public.donations_log b
WHERE a.order_id IS NOT NULL
  AND a.source IN ('order_auto','order_extra')
  AND a.order_id = b.order_id
  AND a.source = b.source
  AND a.created_at = b.created_at
  AND a.id > b.id;

-- Enforce uniqueness: one donation row per (order_id, source) for order-based sources
CREATE UNIQUE INDEX IF NOT EXISTS ux_donations_log_order_source
ON public.donations_log (order_id, source)
WHERE order_id IS NOT NULL AND source IN ('order_auto','order_extra');