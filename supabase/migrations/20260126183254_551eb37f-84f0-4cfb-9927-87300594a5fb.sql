-- Create storage bucket for merchant files if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('merchant-files', 'merchant-files', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Merchants can upload own files" ON storage.objects;
DROP POLICY IF EXISTS "Merchants can view own files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all merchant files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete rejected merchant files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files with consent" ON storage.objects;

-- Policy: Merchants can upload their own files
CREATE POLICY "Merchants can upload own files" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'merchant-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Merchants can view their own files
CREATE POLICY "Merchants can view own files" ON storage.objects
FOR SELECT USING (
    bucket_id = 'merchant-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Admins can view all merchant files
CREATE POLICY "Admins can view all merchant files" ON storage.objects
FOR SELECT USING (
    bucket_id = 'merchant-files' 
    AND public.has_role(auth.uid(), 'admin')
);

-- Policy: Admins can ONLY delete files for REJECTED merchants
CREATE POLICY "Admins can delete rejected merchant files" ON storage.objects
FOR DELETE USING (
    bucket_id = 'merchant-files'
    AND public.has_role(auth.uid(), 'admin')
    AND EXISTS (
        SELECT 1 FROM public.merchant_applications ma
        WHERE ma.user_id::text = (storage.foldername(name))[1]
        AND ma.status = 'rejected'
    )
);

-- Policy: Users can delete their own files only with explicit consent (future feature)
-- For now, approved merchants cannot delete their files
CREATE POLICY "Users can delete own rejected files" ON storage.objects
FOR DELETE USING (
    bucket_id = 'merchant-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND EXISTS (
        SELECT 1 FROM public.merchant_applications ma
        WHERE ma.user_id = auth.uid()
        AND ma.status = 'rejected'
    )
);

-- Create function to auto-calculate badges daily (calls the edge function)
CREATE OR REPLACE FUNCTION public.trigger_badge_calculation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- This function can be called by a cron job to trigger badge calculation
    -- The actual calculation is done by the edge function
    RAISE NOTICE 'Badge calculation triggered at %', now();
END;
$$;