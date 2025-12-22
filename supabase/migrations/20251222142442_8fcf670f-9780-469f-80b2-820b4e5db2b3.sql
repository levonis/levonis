-- Add new fields to competitions table for enhanced features

-- Add hide_participants option
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS hide_participants boolean DEFAULT false;

-- Add unlimited_winners option (when true, winners_count is ignored)
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS unlimited_winners boolean DEFAULT false;

-- Add is_featured option for special display
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- Add prize_product_id to link prize to a product (optional)
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS prize_product_id uuid REFERENCES public.products(id);

-- Update letters_config to support multiple prize words with stock management
-- The letters_config JSONB will now have this structure:
-- {
--   "target_word": "LEVONIS",
--   "letter_probabilities": {"L": 20, "E": 20, ...},
--   "better_luck_probability": 30,
--   "prize_words": [
--     {
--       "word": "LEVONIS",
--       "prize_name_ar": "جائزة كبرى",
--       "prize_value": 1000000,
--       "stock": 10,
--       "product_id": null (optional)
--     },
--     {
--       "word": "WIN",
--       "prize_name_ar": "جائزة صغيرة",
--       "prize_value": 50000,
--       "stock": 100,
--       "product_id": "uuid" (optional)
--     }
--   ]
-- }

-- Create table for tracking letter prize redemptions
CREATE TABLE IF NOT EXISTS public.letter_prize_redemptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  redeemed_word text NOT NULL,
  prize_name_ar text NOT NULL,
  prize_value numeric NOT NULL DEFAULT 0,
  product_id uuid REFERENCES public.products(id),
  letters_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  redeemed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.letter_prize_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own redemptions"
ON public.letter_prize_redemptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Require authentication for redemptions"
ON public.letter_prize_redemptions FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can view all redemptions"
ON public.letter_prize_redemptions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage redemptions"
ON public.letter_prize_redemptions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Function to redeem letters for a prize
CREATE OR REPLACE FUNCTION public.redeem_letters_prize(
  p_competition_id uuid,
  p_word text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_competition record;
  v_letters_config jsonb;
  v_prize_word jsonb;
  v_collected_letters text[];
  v_letter_counts jsonb;
  v_required_letters jsonb;
  v_letter text;
  v_count int;
  v_has_enough boolean := true;
  v_letters_to_use jsonb := '[]'::jsonb;
  v_current_stock int;
  v_prize_index int := -1;
  i int;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'يجب تسجيل الدخول');
  END IF;

  -- Get competition and letters config
  SELECT * INTO v_competition FROM competitions WHERE id = p_competition_id;
  IF v_competition IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'المسابقة غير موجودة');
  END IF;

  v_letters_config := v_competition.letters_config;
  IF v_letters_config IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'هذه المسابقة لا تدعم جمع الأحرف');
  END IF;

  -- Find the prize word configuration
  FOR i IN 0..jsonb_array_length(v_letters_config->'prize_words') - 1 LOOP
    IF v_letters_config->'prize_words'->i->>'word' = p_word THEN
      v_prize_word := v_letters_config->'prize_words'->i;
      v_prize_index := i;
      EXIT;
    END IF;
  END LOOP;

  IF v_prize_word IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الكلمة غير صحيحة');
  END IF;

  -- Check stock
  v_current_stock := COALESCE((v_prize_word->>'stock')::int, 0);
  IF v_current_stock <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'نفذت جوائز هذه الكلمة');
  END IF;

  -- Get user's collected letters for this competition
  SELECT ARRAY_AGG(letter) INTO v_collected_letters
  FROM user_collected_letters
  WHERE user_id = v_user_id AND competition_id = p_competition_id;

  IF v_collected_letters IS NULL THEN
    v_collected_letters := ARRAY[]::text[];
  END IF;

  -- Count each letter the user has
  v_letter_counts := '{}'::jsonb;
  FOREACH v_letter IN ARRAY v_collected_letters LOOP
    v_count := COALESCE((v_letter_counts->>v_letter)::int, 0) + 1;
    v_letter_counts := v_letter_counts || jsonb_build_object(v_letter, v_count);
  END LOOP;

  -- Count required letters for the word
  v_required_letters := '{}'::jsonb;
  FOR i IN 1..length(p_word) LOOP
    v_letter := substring(p_word FROM i FOR 1);
    v_count := COALESCE((v_required_letters->>v_letter)::int, 0) + 1;
    v_required_letters := v_required_letters || jsonb_build_object(v_letter, v_count);
  END LOOP;

  -- Check if user has enough of each letter
  FOR v_letter IN SELECT * FROM jsonb_object_keys(v_required_letters) LOOP
    v_count := COALESCE((v_letter_counts->>v_letter)::int, 0);
    IF v_count < (v_required_letters->>v_letter)::int THEN
      v_has_enough := false;
      EXIT;
    END IF;
  END LOOP;

  IF NOT v_has_enough THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا تملك أحرف كافية لتكوين هذه الكلمة');
  END IF;

  -- Build list of letters to use (for each letter in word, remove one from user's collection)
  FOR i IN 1..length(p_word) LOOP
    v_letter := substring(p_word FROM i FOR 1);
    v_letters_to_use := v_letters_to_use || to_jsonb(v_letter);
    
    -- Delete one instance of this letter from user's collection
    DELETE FROM user_collected_letters 
    WHERE id = (
      SELECT id FROM user_collected_letters 
      WHERE user_id = v_user_id 
        AND competition_id = p_competition_id 
        AND letter = v_letter 
      LIMIT 1
    );
  END LOOP;

  -- Decrease stock in letters_config
  v_letters_config := jsonb_set(
    v_letters_config,
    ARRAY['prize_words', v_prize_index::text, 'stock'],
    to_jsonb(v_current_stock - 1)
  );

  UPDATE competitions SET letters_config = v_letters_config WHERE id = p_competition_id;

  -- Record the redemption
  INSERT INTO letter_prize_redemptions (
    user_id, competition_id, redeemed_word, prize_name_ar, prize_value, product_id, letters_used
  ) VALUES (
    v_user_id,
    p_competition_id,
    p_word,
    v_prize_word->>'prize_name_ar',
    COALESCE((v_prize_word->>'prize_value')::numeric, 0),
    (v_prize_word->>'product_id')::uuid,
    v_letters_to_use
  );

  RETURN jsonb_build_object(
    'success', true,
    'prize_name', v_prize_word->>'prize_name_ar',
    'prize_value', COALESCE((v_prize_word->>'prize_value')::numeric, 0),
    'letters_used', v_letters_to_use
  );
END;
$$;