
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS advisor_priority_boost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advisor_recommended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS advisor_notes text;

CREATE TABLE IF NOT EXISTS public.printer_advisor_budget_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_budget_iqd bigint NOT NULL,
  max_budget_iqd bigint NOT NULL,
  recommended_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  upgrade_suggestion_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  message_ar text,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.printer_advisor_budget_rules TO anon, authenticated;
GRANT ALL ON public.printer_advisor_budget_rules TO service_role;

ALTER TABLE public.printer_advisor_budget_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active budget rules"
  ON public.printer_advisor_budget_rules FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert budget rules"
  ON public.printer_advisor_budget_rules FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update budget rules"
  ON public.printer_advisor_budget_rules FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete budget rules"
  ON public.printer_advisor_budget_rules FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_printer_advisor_rules_updated_at
  BEFORE UPDATE ON public.printer_advisor_budget_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
