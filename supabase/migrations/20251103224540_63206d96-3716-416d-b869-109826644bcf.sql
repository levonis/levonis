-- Add currency field and convert image_url to images array
ALTER TABLE products 
ADD COLUMN currency text DEFAULT 'ريال';

-- Add images array column
ALTER TABLE products 
ADD COLUMN images text[] DEFAULT ARRAY[]::text[];

-- Copy existing image_url to images array
UPDATE products 
SET images = ARRAY[image_url] 
WHERE image_url IS NOT NULL AND image_url != '';

-- Keep image_url for backwards compatibility but make it nullable
ALTER TABLE products 
ALTER COLUMN image_url DROP NOT NULL;