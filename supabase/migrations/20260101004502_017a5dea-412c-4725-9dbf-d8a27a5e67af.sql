-- Add Taobao-related fields to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS taobao_url TEXT,
ADD COLUMN IF NOT EXISTS taobao_variant_mapping JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS taobao_last_sync_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS taobao_sync_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS taobao_availability_cache JSONB DEFAULT '{}'::jsonb;

-- Add Taobao availability fields to product_options table
ALTER TABLE public.product_options
ADD COLUMN IF NOT EXISTS taobao_sku_id TEXT,
ADD COLUMN IF NOT EXISTS taobao_available BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS taobao_last_sync_at TIMESTAMP WITH TIME ZONE;

-- Create sync logs table for error tracking
CREATE TABLE IF NOT EXISTS public.taobao_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  variants_synced INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sync logs
ALTER TABLE public.taobao_sync_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view sync logs
CREATE POLICY "Admins can manage sync logs"
ON public.taobao_sync_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_taobao_url ON public.products(taobao_url) WHERE taobao_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_taobao_sync_logs_product_id ON public.taobao_sync_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_products_taobao_last_sync ON public.products(taobao_last_sync_at) WHERE taobao_url IS NOT NULL;