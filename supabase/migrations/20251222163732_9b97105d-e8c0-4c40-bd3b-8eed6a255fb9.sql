CREATE OR REPLACE FUNCTION public.enter_collect_letters_competition(comp_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID;
  comp_record RECORD;
  user_ticket_count INTEGER;
  new_ticket_id UUID;
  new_ticket_number TEXT;
  letters_config_data JSONB;
  target_word TEXT;
  available_letters TEXT[];
  letter_probs JSONB;
  better_luck_prob NUMERIC;
  awarded_letter TEXT;
  collected_letters_arr TEXT[];
  completed_words TEXT[] := ARRAY[]::TEXT[];
  won_prizes JSONB[] := ARRAY[]::JSONB[];
  prize_config JSONB;
  random_val NUMERIC;
  cumulative_prob NUMERIC;
  i INTEGER;
  letter_key TEXT;
  is_better_luck BOOLEAN := false;
  total_weight NUMERIC := 0;
  weight NUMERIC;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  -- Get competition
  SELECT * INTO comp_record
  FROM competitions
  WHERE id = comp_id AND status = 'active' AND competition_type = 'collect_letters';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المسابقة غير متاحة');
  END IF;

  -- Check user ticket balance
  SELECT ticket_count INTO user_ticket_count
  FROM user_tickets
  WHERE user_id = current_user_id;

  IF user_ticket_count IS NULL OR user_ticket_count < comp_record.required_tickets THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يوجد تذاكر كافية');
  END IF;

  -- Parse letters config
  letters_config_data := comp_record.letters_config;
  target_word := letters_config_data->>'target_word';
  letter_probs := letters_config_data->'letter_probabilities';
  better_luck_prob := COALESCE((letters_config_data->>'better_luck_probability')::NUMERIC, 0);

  -- Get unique letters from target word
  SELECT ARRAY_AGG(DISTINCT letter) INTO available_letters
  FROM unnest(regexp_split_to_array(target_word, '')) AS letter
  WHERE letter != '';

  -- Deduct tickets
  UPDATE user_tickets
  SET ticket_count = user_tickets.ticket_count - comp_record.required_tickets,
      updated_at = now()
  WHERE user_id = current_user_id;

  -- First check if this is a "better luck" result
  random_val := random() * 100;
  IF random_val < better_luck_prob THEN
    is_better_luck := true;
    awarded_letter := NULL;
  ELSE
    -- Select letter based on probabilities.
    -- IMPORTANT:
    -- - A letter with probability 0 MUST never be selected.
    -- - Missing probabilities are treated as 0 (not an equal fallback).
    -- - If sum of probabilities < 100, the remainder becomes "better luck".

    IF letter_probs IS NULL THEN
      -- Equal probability (legacy behavior when probabilities are not set at all)
      awarded_letter := available_letters[1 + floor(random() * array_length(available_letters, 1))::int];
    ELSE
      total_weight := 0;
      FOR i IN 1..array_length(available_letters, 1) LOOP
        letter_key := available_letters[i];
        weight := COALESCE(NULLIF((letter_probs->>letter_key), '')::NUMERIC, 0);
        IF weight < 0 THEN
          weight := 0;
        END IF;
        total_weight := total_weight + weight;
      END LOOP;

      IF total_weight <= 0 THEN
        is_better_luck := true;
        awarded_letter := NULL;
      ELSE
        random_val := random() * 100;
        cumulative_prob := 0;
        awarded_letter := NULL;

        FOR i IN 1..array_length(available_letters, 1) LOOP
          letter_key := available_letters[i];
          weight := COALESCE(NULLIF((letter_probs->>letter_key), '')::NUMERIC, 0);
          IF weight < 0 THEN
            weight := 0;
          END IF;

          cumulative_prob := cumulative_prob + weight;
          IF random_val <= cumulative_prob THEN
            awarded_letter := letter_key;
            EXIT;
          END IF;
        END LOOP;

        -- If random landed in the "remainder" (sum < 100) => better luck
        IF awarded_letter IS NULL THEN
          is_better_luck := true;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Generate ticket number
  new_ticket_number := generate_ticket_number(comp_id);

  -- Create ticket
  INSERT INTO competition_tickets (
    competition_id,
    user_id,
    ticket_number,
    letter_awarded,
    revealed_at
  )
  VALUES (
    comp_id,
    current_user_id,
    new_ticket_number,
    awarded_letter,
    now()
  )
  RETURNING id INTO new_ticket_id;

  -- If not "better luck", record collected letter and check for prizes
  IF NOT is_better_luck THEN
    -- Record collected letter
    INSERT INTO user_collected_letters (user_id, competition_id, letter, ticket_id)
    VALUES (current_user_id, comp_id, awarded_letter, new_ticket_id);

    -- Get all collected letters for this user in this competition
    SELECT ARRAY_AGG(letter) INTO collected_letters_arr
    FROM user_collected_letters
    WHERE user_id = current_user_id AND competition_id = comp_id;

    -- Check if user completed any prize word
    IF letters_config_data->'prizes' IS NOT NULL THEN
      FOR prize_config IN SELECT * FROM jsonb_array_elements(letters_config_data->'prizes')
      LOOP
        DECLARE
          prize_word TEXT;
          word_letters TEXT[];
          has_all_letters BOOLEAN := true;
          check_letter TEXT;
        BEGIN
          prize_word := prize_config->>'word';
          word_letters := regexp_split_to_array(prize_word, '');

          -- Check each letter count
          FOR check_letter IN SELECT DISTINCT l FROM unnest(word_letters) l WHERE l != ''
          LOOP
            IF (
              SELECT COUNT(*) FROM unnest(collected_letters_arr) l WHERE l = check_letter
            ) < (
              SELECT COUNT(*) FROM unnest(word_letters) l WHERE l = check_letter
            ) THEN
              has_all_letters := false;
              EXIT;
            END IF;
          END LOOP;

          IF has_all_letters THEN
            completed_words := array_append(completed_words, prize_word);
            won_prizes := array_append(won_prizes, prize_config);
          END IF;
        END;
      END LOOP;
    END IF;
  ELSE
    -- still need collected letters array for response
    SELECT ARRAY_AGG(letter) INTO collected_letters_arr
    FROM user_collected_letters
    WHERE user_id = current_user_id AND competition_id = comp_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', new_ticket_id,
    'ticket_number', new_ticket_number,
    'letter', awarded_letter,
    'is_better_luck', is_better_luck,
    'collected_letters', COALESCE(collected_letters_arr, ARRAY[]::TEXT[]),
    'completed_words', completed_words,
    'won_prizes', won_prizes
  );
END;
$function$;