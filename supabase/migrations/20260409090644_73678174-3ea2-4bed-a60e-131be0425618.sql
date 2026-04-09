ALTER TABLE public.future_shipments
  DROP CONSTRAINT future_shipments_draft_id_fkey;

ALTER TABLE public.future_shipments
  ADD CONSTRAINT future_shipments_draft_id_fkey
  FOREIGN KEY (draft_id)
  REFERENCES public.purchase_drafts(id)
  ON DELETE SET NULL;