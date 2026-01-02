-- Fix enter_collect_letters_competition to use the correct letters_config format from DB
CREATE OR REPLACE FUNCTION public.enter_collect_letters_competition(comp_id uuid, quantity integer DEFAULT 1)
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
  letters_array JSONB;
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
  bag_idx INTEGER;
  letter_item JSONB;
  letter_key TEXT;
  is_better_luck BOOLEAN := false;
  is_ticket_reward BOOLEAN := false;
  total_letter_prob NUMERIC := 0;
  total_ticket_prob NUMERIC := 0;
  letter_prob NUMERIC;
  ticket_reward_item JSONB;
  grand_total NUMERIC;
  results JSONB[] := ARRAY[]::JSONB[];
  single_result JSONB;
  total_tickets_needed INTEGER;
  letters_count INTEGER := 0;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;
  
  -- Validate quantity
  IF quantity < 1 THEN
    quantity := 1;
  END IF;
  IF quantity > 100 THEN
    quantity := 100;
  END IF;

  -- Get competition
  SELECT * INTO comp_record
  FROM competitions
  WHERE id = comp_id AND status = 'active' AND competition_type = 'collect_letters';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المسابقة غير متاحة');
  END IF;

  -- Check total tickets needed
  total_tickets_needed := comp_record.required_tickets * quantity;
  
  -- Check user ticket balance
  SELECT ticket_count INTO user_ticket_count
  FROM user_tickets
  WHERE user_id = current_user_id;

  IF user_ticket_count IS NULL OR user_ticket_count < total_tickets_needed THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يوجد تذاكر كافية. تحتاج ' || total_tickets_needed || ' تذكرة');
  END IF;

  -- Parse letters config
  letters_config_data := comp_record.letters_config;
  
  -- Validate letters_config exists
  IF letters_config_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'إعدادات الأحرف غير موجودة');
  END IF;

  -- Get letters array from config (new format: letters array with letter and probability)
  letters_array := letters_config_data->'letters';
  
  IF letters_array IS NULL OR jsonb_array_length(letters_array) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا توجد أحرف مهيأة');
  END IF;
  
  -- Build available_letters array and letter_probs object from letters array
  available_letters := ARRAY[]::TEXT[];
  letter_probs := '{}'::JSONB;
  
  FOR letter_item IN SELECT * FROM jsonb_array_elements(letters_array)
  LOOP
    letter_key := letter_item->>'letter';
    IF letter_key IS NOT NULL AND length(letter_key) > 0 THEN
      available_letters := array_append(available_letters, letter_key);
      letter_probs := letter_probs || jsonb_build_object(letter_key, COALESCE((letter_item->>'probability')::NUMERIC, 0));
    END IF;
  END LOOP;
  
  IF array_length(available_letters, 1) IS NULL OR array_length(available_letters, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا توجد أحرف صالحة');
  END IF;

  better_luck_prob := COALESCE((letters_config_data->>'better_luck_probability')::NUMERIC, 0);
  ticket_rewards := letters_config_data->'ticket_rewards';

  -- Deduct all tickets at once
  UPDATE user_tickets
  SET ticket_count = user_tickets.ticket_count - total_tickets_needed,
      updated_at = now()
  WHERE user_id = current_user_id;

  -- Calculate total probability of all letters
  FOR i IN 1..array_length(available_letters, 1) LOOP
    letter_key := available_letters[i];
    letter_prob := COALESCE((letter_probs->>letter_key)::NUMERIC, 0);
    IF letter_prob < 0 THEN
      letter_prob := 0;
    END IF;
    total_letter_prob := total_letter_prob + letter_prob;
  END LOOP;

  -- Calculate total probability of ticket rewards
  IF ticket_rewards IS NOT NULL THEN
    FOR ticket_reward_item IN SELECT * FROM jsonb_array_elements(ticket_rewards)
    LOOP
      total_ticket_prob := total_ticket_prob + COALESCE((ticket_reward_item->>'probability')::NUMERIC, 0);
    END LOOP;
  END IF;

  -- Calculate grand total
  grand_total := better_luck_prob + total_ticket_prob + total_letter_prob;
  IF grand_total <= 0 THEN
    grand_total := 100;
  END IF;

  -- Process each bag
  FOR bag_idx IN 1..quantity LOOP
    is_better_luck := false;
    is_ticket_reward := false;
    awarded_letter := NULL;
    awarded_tickets := 0;
    
    -- Generate random value
    IF grand_total < 100 THEN
      random_val := random() * 100;
    ELSE
      random_val := random() * grand_total;
    END IF;
    
    cumulative_prob := 0;
    
    -- Check better luck first
    IF random_val < better_luck_prob THEN
      is_better_luck := true;
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
            EXIT;
          END IF;
        END LOOP;
      END IF;
      
      -- If not ticket reward, check letters
      IF NOT is_ticket_reward THEN
        FOR i IN 1..array_length(available_letters, 1) LOOP
          letter_key := available_letters[i];
          letter_prob := COALESCE((letter_probs->>letter_key)::NUMERIC, 0);
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
        
        -- If random landed beyond all defined probabilities => better luck
        IF awarded_letter IS NULL AND NOT is_ticket_reward THEN
          is_better_luck := true;
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
    END IF;
    
    -- Add result to results array
    results := array_append(results, jsonb_build_object(
      'ticket_id', new_ticket_id,
      'ticket_number', new_ticket_number,
      'letter_awarded', awarded_letter,
      'is_better_luck', is_better_luck,
      'is_ticket_reward', is_ticket_reward,
      'tickets_awarded', awarded_tickets
    ));
  END LOOP;

  -- Get all collected letters for this user in this competition
  SELECT ARRAY_AGG(letter) INTO collected_letters_arr
  FROM user_collected_letters
  WHERE user_id = current_user_id AND competition_id = comp_id;

  IF collected_letters_arr IS NULL THEN
    collected_letters_arr := ARRAY[]::TEXT[];
  END IF;

  -- Check for completed words using prize_words from config
  IF letters_config_data->'prize_words' IS NOT NULL THEN
    FOR prize_config IN SELECT * FROM jsonb_array_elements(letters_config_data->'prize_words')
    LOOP
      DECLARE
        prize_word TEXT := UPPER(TRIM(prize_config->>'word'));
        prize_letters TEXT[];
        has_all_letters BOOLEAN := true;
        letter_char TEXT;
        already_redeemed BOOLEAN;
      BEGIN
        IF prize_word IS NULL OR prize_word = '' THEN
          CONTINUE;
        END IF;
        
        -- Check if already redeemed
        SELECT EXISTS(
          SELECT 1 FROM letter_prize_redemptions
          WHERE user_id = current_user_id
            AND competition_id = comp_id
            AND UPPER(redeemed_word) = prize_word
        ) INTO already_redeemed;

        IF NOT already_redeemed THEN
          -- Get unique letters in prize word
          SELECT ARRAY_AGG(DISTINCT UPPER(letter)) INTO prize_letters
          FROM unnest(regexp_split_to_array(prize_word, '')) AS letter
          WHERE letter != '' AND letter != ' ';

          IF prize_letters IS NOT NULL THEN
            -- Check if user has all letters (case insensitive)
            FOREACH letter_char IN ARRAY prize_letters LOOP
              IF NOT (UPPER(letter_char) = ANY(SELECT UPPER(unnest(collected_letters_arr)))) THEN
                has_all_letters := false;
                EXIT;
              END IF;
            END LOOP;

            IF has_all_letters THEN
              completed_words := array_append(completed_words, prize_word);
              won_prizes := array_append(won_prizes, prize_config);
            END IF;
          END IF;
        END IF;
      END;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'results', results,
    'collected_letters', collected_letters_arr,
    'completed_words', completed_words,
    'won_prizes', won_prizes
  );
END;
$function$;