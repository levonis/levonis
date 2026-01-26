-- Add new columns for multiple images, video, and material type
ALTER TABLE public.community_print_requests
  ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS material_type text DEFAULT 'any';

-- Update image_url to be nullable since we'll use images array
ALTER TABLE public.community_print_requests
  ALTER COLUMN image_url DROP NOT NULL;

-- Add comment for material_type values: filament, resin, both, any
COMMENT ON COLUMN public.community_print_requests.material_type IS 'Material type: filament, resin, both, any';