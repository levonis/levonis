ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS media_chroma_key TEXT DEFAULT 'none';

COMMENT ON COLUMN public.categories.media_chroma_key IS 'Chroma key removal: none | black | white';