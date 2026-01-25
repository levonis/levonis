-- Add selected_frame_id to merchant_public_profiles
ALTER TABLE public.merchant_public_profiles 
ADD COLUMN IF NOT EXISTS selected_frame_id UUID REFERENCES public.avatar_frames(id) ON DELETE SET NULL;

-- Also add to merchant_applications for editing
ALTER TABLE public.merchant_applications 
ADD COLUMN IF NOT EXISTS selected_frame_id UUID REFERENCES public.avatar_frames(id) ON DELETE SET NULL;

-- Create index for frame lookups
CREATE INDEX IF NOT EXISTS idx_merchant_profiles_frame ON public.merchant_public_profiles(selected_frame_id);
CREATE INDEX IF NOT EXISTS idx_merchant_applications_frame ON public.merchant_applications(selected_frame_id);