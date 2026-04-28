ALTER TABLE public.saved_invoices
  ADD COLUMN IF NOT EXISTS user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS printer_id uuid NULL REFERENCES public.store_printers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_saved_invoices_user_id ON public.saved_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_invoices_printer_id ON public.saved_invoices(printer_id);

UPDATE public.saved_invoices si
SET user_id = o.user_id
FROM public.orders o
WHERE si.order_id = o.id
  AND si.user_id IS NULL
  AND o.user_id IS NOT NULL;