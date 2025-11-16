-- Create table for saved invoices
CREATE TABLE IF NOT EXISTS public.saved_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  invoice_html TEXT NOT NULL,
  template_id UUID REFERENCES public.invoice_templates(id) ON DELETE SET NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  warranty_expires_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_invoices ENABLE ROW LEVEL SECURITY;

-- Policies for saved invoices
CREATE POLICY "Admins can view all saved invoices"
ON public.saved_invoices FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their saved invoices"
ON public.saved_invoices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = saved_invoices.order_id
    AND orders.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert saved invoices"
ON public.saved_invoices FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can update saved invoices"
ON public.saved_invoices FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete saved invoices"
ON public.saved_invoices FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add index for faster queries
CREATE INDEX idx_saved_invoices_order_id ON public.saved_invoices(order_id);
CREATE INDEX idx_saved_invoices_warranty ON public.saved_invoices(warranty_expires_at);

-- Add serial_image_url to invoice templates config
COMMENT ON TABLE public.saved_invoices IS 'Stores generated invoices for warranty tracking and review';