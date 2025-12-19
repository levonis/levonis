-- Add images array column to competitions table
ALTER TABLE public.competitions 
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Migrate existing image_url to images array
UPDATE public.competitions 
SET images = CASE 
  WHEN image_url IS NOT NULL AND image_url != '' THEN ARRAY[image_url]
  ELSE ARRAY[]::TEXT[]
END
WHERE images IS NULL OR images = ARRAY[]::TEXT[];