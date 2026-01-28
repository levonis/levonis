-- Add edit_count column to track offer edits
ALTER TABLE public.print_offers 
ADD COLUMN IF NOT EXISTS edit_count integer NOT NULL DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.print_offers.edit_count IS 'Number of times this offer has been edited. Max 1 edit allowed.';