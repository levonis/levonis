-- Add new columns for additional order tracking and files
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS admin_images text[] DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS admin_files text[] DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS estimated_delivery_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS actual_weight numeric,
ADD COLUMN IF NOT EXISTS package_dimensions text,
ADD COLUMN IF NOT EXISTS customs_declaration_number text,
ADD COLUMN IF NOT EXISTS internal_notes text,
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_method text;

-- Create storage bucket for order files if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-files', 'order-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for admin uploads
CREATE POLICY "Admins can upload order files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'order-files' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can update order files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'order-files' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete order files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'order-files' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Anyone can view order files"
ON storage.objects FOR SELECT
USING (bucket_id = 'order-files');