-- Create invoice templates table
CREATE TABLE IF NOT EXISTS public.invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  template_config JSONB NOT NULL DEFAULT '{
    "layout": {
      "pageSize": "A4",
      "margin": "20px",
      "direction": "rtl"
    },
    "header": {
      "show": true,
      "backgroundColor": "#123f35",
      "textColor": "#d4af37",
      "fontSize": "24px",
      "fontFamily": "Cairo",
      "title": "فاتورة مبيعات",
      "titleEn": "Sales Invoice",
      "logoUrl": "",
      "padding": "20px"
    },
    "serialSection": {
      "show": true,
      "backgroundColor": "#f8f9fa",
      "fontSize": "14px",
      "fontFamily": "Cairo",
      "padding": "15px",
      "borderRadius": "8px"
    },
    "customerInfo": {
      "show": true,
      "fontSize": "14px",
      "fontFamily": "Cairo",
      "labelColor": "#123f35",
      "valueColor": "#1f2937",
      "padding": "10px"
    },
    "itemsTable": {
      "show": true,
      "headerBackgroundColor": "#123f35",
      "headerTextColor": "#d4af37",
      "rowBackgroundColor": "#ffffff",
      "alternateRowColor": "#f8f9fa",
      "borderColor": "#e5e7eb",
      "fontSize": "14px",
      "fontFamily": "Cairo",
      "padding": "12px"
    },
    "totalsSection": {
      "show": true,
      "backgroundColor": "#f8f9fa",
      "fontSize": "16px",
      "fontFamily": "Cairo",
      "labelColor": "#123f35",
      "valueColor": "#1f2937",
      "fontWeight": "bold",
      "padding": "15px"
    },
    "warrantySection": {
      "show": true,
      "fontSize": "12px",
      "fontFamily": "Cairo",
      "textColor": "#6b7280",
      "padding": "15px",
      "borderTop": "1px solid #e5e7eb"
    },
    "footer": {
      "show": true,
      "backgroundColor": "#123f35",
      "textColor": "#d4af37",
      "fontSize": "12px",
      "fontFamily": "Cairo",
      "text": "شكراً لتعاملكم معنا",
      "textEn": "Thank you for your business",
      "padding": "15px"
    },
    "customFields": []
  }'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view invoice templates"
  ON public.invoice_templates
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage invoice templates"
  ON public.invoice_templates
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default template
INSERT INTO public.invoice_templates (name, name_ar, is_default)
VALUES ('Default Template', 'القالب الافتراضي', true)
ON CONFLICT DO NOTHING;