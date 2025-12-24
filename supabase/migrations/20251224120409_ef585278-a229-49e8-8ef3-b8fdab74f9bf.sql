-- Fix letter probability calculation to work correctly with percentages
-- The current logic uses cumulative probabilities which is correct, but the total should be normalized

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
  ticket_rewards JSONB;
  awarded_letter TEXT;
  awarded_tickets INTEGER := 0;
  collected_letters_arr TEXT[];
  completed_words TEXT[] := ARRAY[]::TEXT[];
  won_prizes JSONB[] := ARRAY[]::JSONB[];
  prize_config JSONB;
  random_val NUMERIC;
  cumulative_prob NUMERIC;
  i INTEGER;
  letter_key TEXT;
  is_better_luck BOOLEAN := false;
  is_ticket_reward BOOLEAN := false;
  total_letter_prob NUMERIC := 0;
  total_ticket_prob NUMERIC := 0;
  letter_prob NUMERIC;
  ticket_reward_item JSONB;
  grand_total NUMERIC;
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
  ticket_rewards := letters_config_data->'ticket_rewards';

  -- Get unique letters from target word
  SELECT ARRAY_AGG(DISTINCT letter) INTO available_letters
  FROM unnest(regexp_split_to_array(target_word, '')) AS letter
  WHERE letter != '';

  -- Deduct tickets
  UPDATE user_tickets
  SET ticket_count = user_tickets.ticket_count - comp_record.required_tickets,
      updated_at = now()
  WHERE user_id = current_user_id;

  -- Calculate total probability of all letters
  IF letter_probs IS NOT NULL AND available_letters IS NOT NULL THEN
    FOR i IN 1..array_length(available_letters, 1) LOOP
      letter_key := available_letters[i];
      letter_prob := COALESCE(NULLIF((letter_probs->>letter_key), '')::NUMERIC, 0);
      IF letter_prob < 0 THEN
        letter_prob := 0;
      END IF;
      total_letter_prob := total_letter_prob + letter_prob;
    END LOOP;
  END IF;

  -- Calculate total probability of ticket rewards
  IF ticket_rewards IS NOT NULL THEN
    FOR ticket_reward_item IN SELECT * FROM jsonb_array_elements(ticket_rewards)
    LOOP
      total_ticket_prob := total_ticket_prob + COALESCE((ticket_reward_item->>'probability')::NUMERIC, 0);
    END LOOP;
  END IF;

  -- Calculate grand total and auto-adjust better luck if needed
  grand_total := better_luck_prob + total_ticket_prob + total_letter_prob;
  
  -- If grand total < 100, the remainder goes to better luck
  -- If grand total > 100, we need to normalize (but we'll use it as-is for now)
  
  -- Generate a single random value from 0 to grand_total (or 100 if grand_total < 100)
  IF grand_total < 100 THEN
    random_val := random() * 100;
  ELSE
    random_val := random() * grand_total;
  END IF;

  cumulative_prob := 0;

  -- Check better luck first
  IF random_val < better_luck_prob THEN
    is_better_luck := true;
    awarded_letter := NULL;
  ELSE
    cumulative_prob := better_luck_prob;
    
    -- Check ticket rewards
    IF ticket_rewards IS NOT NULL AND total_ticket_prob > 0 THEN
      FOR ticket_reward_item IN SELECT * FROM jsonb_array_elements(ticket_rewards)
      LOOP
        cumulative_prob := cumulative_prob + COALESCE((ticket_reward_item->>'probability')::NUMERIC, 0);
        IF random_val < cumulative_prob THEN
          is_ticket_reward := true;
          awarded_tickets := COALESCE((ticket_reward_item->>'tickets')::INTEGER, 1);
          awarded_letter := NULL;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    -- If not ticket reward, check letters
    IF NOT is_ticket_reward THEN
      IF letter_probs IS NULL OR total_letter_prob <= 0 THEN
        -- No probabilities defined or all zero - better luck
        is_better_luck := true;
        awarded_letter := NULL;
      ELSE
        -- Check each letter's probability range
        IF available_letters IS NOT NULL THEN
          FOR i IN 1..array_length(available_letters, 1) LOOP
            letter_key := available_letters[i];
            letter_prob := COALESCE(NULLIF((letter_probs->>letter_key), '')::NUMERIC, 0);
            IF letter_prob < 0 THEN
              letter_prob := 0;
            END IF;

            IF letter_prob > 0 THEN
              cumulative_prob := cumulative_prob + letter_prob;
              IF random_val < cumulative_prob THEN
                awarded_letter := letter_key;
                EXIT;
              END IF;
            END IF;
          END LOOP;
        END IF;

        -- If random landed beyond all defined probabilities => better luck
        IF awarded_letter IS NULL AND NOT is_ticket_reward THEN
          is_better_luck := true;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Generate ticket number
  new_ticket_number := generate_ticket_number(comp_id);

  -- Create ticket record
  INSERT INTO competition_tickets (
    competition_id,
    user_id,
    ticket_number,
    letter_awarded,
    prize_won,
    revealed_at
  )
  VALUES (
    comp_id,
    current_user_id,
    new_ticket_number,
    awarded_letter,
    CASE 
      WHEN is_ticket_reward THEN jsonb_build_object('type', 'ticket_reward', 'tickets', awarded_tickets)
      ELSE NULL
    END,
    now()
  )
  RETURNING id INTO new_ticket_id;

  -- Save collected letter if awarded
  IF NOT is_better_luck AND NOT is_ticket_reward AND awarded_letter IS NOT NULL THEN
    INSERT INTO user_collected_letters (
      user_id,
      competition_id,
      letter,
      ticket_id
    )
    VALUES (
      current_user_id,
      comp_id,
      awarded_letter,
      new_ticket_id
    );
  END IF;

  -- Add ticket reward to user's tickets
  IF is_ticket_reward AND awarded_tickets > 0 THEN
    UPDATE user_tickets
    SET ticket_count = user_tickets.ticket_count + awarded_tickets,
        updated_at = now()
    WHERE user_id = current_user_id;

    -- Create notification for ticket reward
    INSERT INTO notifications (user_id, title, message, type, related_id)
    VALUES (
      current_user_id,
      '🎫 ربحت تذاكر إضافية!',
      'حصلت على ' || awarded_tickets || ' تذكرة إضافية!',
      'success',
      new_ticket_id::text
    );
  END IF;

  -- Get all collected letters for this user in this competition
  SELECT ARRAY_AGG(letter) INTO collected_letters_arr
  FROM user_collected_letters
  WHERE user_id = current_user_id AND competition_id = comp_id;

  IF collected_letters_arr IS NULL THEN
    collected_letters_arr := ARRAY[]::TEXT[];
  END IF;

  -- Check for completed words
  IF letters_config_data->'prizes' IS NOT NULL THEN
    FOR prize_config IN SELECT * FROM jsonb_array_elements(letters_config_data->'prizes')
    LOOP
      DECLARE
        prize_word TEXT := prize_config->>'word';
        prize_letters TEXT[];
        has_all_letters BOOLEAN := true;
        letter_char TEXT;
        already_redeemed BOOLEAN;
      BEGIN
        -- Check if already redeemed
        SELECT EXISTS(
          SELECT 1 FROM letter_prize_redemptions
          WHERE user_id = current_user_id
            AND competition_id = comp_id
            AND redeemed_word = prize_word
        ) INTO already_redeemed;

        IF NOT already_redeemed THEN
          -- Get unique letters in prize word
          SELECT ARRAY_AGG(DISTINCT letter) INTO prize_letters
          FROM unnest(regexp_split_to_array(prize_word, '')) AS letter
          WHERE letter != '';

          -- Check if user has all letters
          FOREACH letter_char IN ARRAY prize_letters LOOP
            IF NOT (letter_char = ANY(collected_letters_arr)) THEN
              has_all_letters := false;
              EXIT;
            END IF;
          END LOOP;

          IF has_all_letters THEN
            completed_words := array_append(completed_words, prize_word);
            won_prizes := array_append(won_prizes, prize_config);
          END IF;
        END IF;
      END;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', new_ticket_id,
    'ticket_number', new_ticket_number,
    'letter_awarded', awarded_letter,
    'is_better_luck', is_better_luck,
    'is_ticket_reward', is_ticket_reward,
    'tickets_awarded', awarded_tickets,
    'collected_letters', collected_letters_arr,
    'completed_words', completed_words,
    'won_prizes', won_prizes
  );
END;
$function$;