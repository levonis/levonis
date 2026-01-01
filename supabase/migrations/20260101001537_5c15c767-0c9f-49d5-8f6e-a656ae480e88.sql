-- Fix CASCADE DELETE on competition_tickets to preserve participant data
-- Change from CASCADE to SET NULL so tickets remain even if competition is removed

-- Drop existing foreign key constraints and recreate with SET NULL
ALTER TABLE public.competition_tickets 
DROP CONSTRAINT IF EXISTS competition_tickets_competition_id_fkey;

ALTER TABLE public.competition_tickets
ADD CONSTRAINT competition_tickets_competition_id_fkey 
FOREIGN KEY (competition_id) 
REFERENCES public.competitions(id) 
ON DELETE SET NULL;

-- Make competition_id nullable to allow SET NULL behavior
ALTER TABLE public.competition_tickets 
ALTER COLUMN competition_id DROP NOT NULL;

-- Fix user_collected_letters - change CASCADE to SET NULL
ALTER TABLE public.user_collected_letters 
DROP CONSTRAINT IF EXISTS user_collected_letters_competition_id_fkey;

ALTER TABLE public.user_collected_letters
ADD CONSTRAINT user_collected_letters_competition_id_fkey 
FOREIGN KEY (competition_id) 
REFERENCES public.competitions(id) 
ON DELETE SET NULL;

ALTER TABLE public.user_collected_letters 
ALTER COLUMN competition_id DROP NOT NULL;

-- Fix letter_prize_redemptions - change CASCADE to SET NULL
ALTER TABLE public.letter_prize_redemptions 
DROP CONSTRAINT IF EXISTS letter_prize_redemptions_competition_id_fkey;

ALTER TABLE public.letter_prize_redemptions
ADD CONSTRAINT letter_prize_redemptions_competition_id_fkey 
FOREIGN KEY (competition_id) 
REFERENCES public.competitions(id) 
ON DELETE SET NULL;

ALTER TABLE public.letter_prize_redemptions 
ALTER COLUMN competition_id DROP NOT NULL;

-- Fix letter_prize_coupons - change CASCADE to SET NULL
ALTER TABLE public.letter_prize_coupons 
DROP CONSTRAINT IF EXISTS letter_prize_coupons_competition_id_fkey;

ALTER TABLE public.letter_prize_coupons
ADD CONSTRAINT letter_prize_coupons_competition_id_fkey 
FOREIGN KEY (competition_id) 
REFERENCES public.competitions(id) 
ON DELETE SET NULL;

ALTER TABLE public.letter_prize_coupons 
ALTER COLUMN competition_id DROP NOT NULL;