-- Update the enter_collect_letters_competition function to accept quantity parameter
CREATE OR REPLACE FUNCTION public.enter_collect_letters_competition(comp_id UUID, quantity INTEGER DEFAULT 1)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- Multi-bag variables
  bag_idx INTEGER;
  results JSONB[] := ARRAY[]::JSONB[];
  single_result JSONB;
  total_tickets_needed INTEGER;
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
    quantity := 100; -- Max 100 bags at once
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
  target_word := letters_config_data->>'target_word';
  letter_probs := letters_config_data->'letter_probabilities';
  better_luck_prob := COALESCE((letters_config_data->>'better_luck_probability')::NUMERIC, 0);
  ticket_rewards := letters_config_data->'ticket_rewards';

  -- Get unique letters from target word
  SELECT ARRAY_AGG(DISTINCT letter) INTO available_letters
  FROM unnest(regexp_split_to_array(target_word, '')) AS letter
  WHERE letter != '';

  -- Deduct all tickets at once
  UPDATE user_tickets
  SET ticket_count = user_tickets.ticket_count - total_tickets_needed,
      updated_at = now()
  WHERE user_id = current_user_id;

  -- Calculate total probability of all letters
  total_letter_prob := 0;
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
  total_ticket_prob := 0;
  IF ticket_rewards IS NOT NULL THEN
    FOR ticket_reward_item IN SELECT * FROM jsonb_array_elements(ticket_rewards)
    LOOP
      total_ticket_prob := total_ticket_prob + COALESCE((ticket_reward_item->>'probability')::NUMERIC, 0);
    END LOOP;
  END IF;

  -- Get current collected letters
  SELECT ARRAY_AGG(letter) INTO collected_letters_arr
  FROM user_collected_letters
  WHERE user_id = current_user_id AND competition_id = comp_id;

  IF collected_letters_arr IS NULL THEN
    collected_letters_arr := ARRAY[]::TEXT[];
  END IF;

  -- Process each bag
  FOR bag_idx IN 1..quantity LOOP
    -- Reset per-bag variables
    awarded_letter := NULL;
    awarded_tickets := 0;
    is_better_luck := false;
    is_ticket_reward := false;
    
    -- Calculate grand total
    grand_total := better_luck_prob + total_ticket_prob + total_letter_prob;
    
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
      IF NOT is_ticket_reward AND NOT is_better_luck THEN
        IF letter_probs IS NOT NULL AND available_letters IS NOT NULL AND total_letter_prob > 0 THEN
          FOR i IN 1..array_length(available_letters, 1) LOOP
            letter_key := available_letters[i];
            letter_prob := COALESCE(NULLIF((letter_probs->>letter_key), '')::NUMERIC, 0);
            IF letter_prob < 0 THEN
              letter_prob := 0;
            END IF;
            cumulative_prob := cumulative_prob + letter_prob;
            IF random_val < cumulative_prob THEN
              awarded_letter := letter_key;
              EXIT;
            END IF;
          END LOOP;
        END IF;
        
        -- If nothing was awarded (remainder goes to better luck)
        IF awarded_letter IS NULL THEN
          is_better_luck := true;
        END IF;
      END IF;
    END IF;

    -- Generate ticket number
    new_ticket_number := generate_ticket_number(comp_id);

    -- Create competition ticket
    INSERT INTO competition_tickets (competition_id, user_id, ticket_number, letter_awarded, is_winner)
    VALUES (comp_id, current_user_id, new_ticket_number, awarded_letter, false)
    RETURNING id INTO new_ticket_id;

    -- If letter awarded, add to collected letters
    IF awarded_letter IS NOT NULL THEN
      INSERT INTO user_collected_letters (user_id, competition_id, letter, ticket_id)
      VALUES (current_user_id, comp_id, awarded_letter, new_ticket_id);
      
      -- Add to our tracking array
      collected_letters_arr := array_append(collected_letters_arr, awarded_letter);
    END IF;

    -- If ticket reward, add tickets to user
    IF is_ticket_reward AND awarded_tickets > 0 THEN
      UPDATE user_tickets
      SET ticket_count = ticket_count + awarded_tickets,
          updated_at = now()
      WHERE user_id = current_user_id;
    END IF;

    -- Build single result for this bag
    single_result := jsonb_build_object(
      'letter_awarded', awarded_letter,
      'is_better_luck', is_better_luck,
      'is_ticket_reward', is_ticket_reward,
      'tickets_awarded', awarded_tickets,
      'ticket_number', new_ticket_number
    );
    
    results := array_append(results, single_result);
  END LOOP;

  -- Check for completed words (after all bags processed)
  IF letters_config_data->'prize_words' IS NOT NULL THEN
    FOR prize_config IN SELECT * FROM jsonb_array_elements(letters_config_data->'prize_words')
    LOOP
      DECLARE
        prize_word TEXT;
        word_letters TEXT[];
        required_counts JSONB := '{}'::JSONB;
        user_letter_counts JSONB := '{}'::JSONB;
        can_complete BOOLEAN := true;
        letter_check TEXT;
        required_count INTEGER;
        user_count INTEGER;
      BEGIN
        prize_word := prize_config->>'word';
        
        IF prize_word IS NULL OR prize_word = '' THEN
          CONTINUE;
        END IF;
        
        SELECT ARRAY_AGG(l) INTO word_letters FROM unnest(regexp_split_to_array(prize_word, '')) AS l WHERE l != '';
        
        FOR i IN 1..array_length(word_letters, 1) LOOP
          letter_check := word_letters[i];
          required_count := COALESCE((required_counts->>letter_check)::INTEGER, 0) + 1;
          required_counts := required_counts || jsonb_build_object(letter_check, required_count);
        END LOOP;
        
        FOR i IN 1..array_length(collected_letters_arr, 1) LOOP
          letter_check := collected_letters_arr[i];
          user_count := COALESCE((user_letter_counts->>letter_check)::INTEGER, 0) + 1;
          user_letter_counts := user_letter_counts || jsonb_build_object(letter_check, user_count);
        END LOOP;
        
        FOR letter_check IN SELECT * FROM jsonb_object_keys(required_counts)
        LOOP
          required_count := (required_counts->>letter_check)::INTEGER;
          user_count := COALESCE((user_letter_counts->>letter_check)::INTEGER, 0);
          IF user_count < required_count THEN
            can_complete := false;
            EXIT;
          END IF;
        END LOOP;
        
        IF can_complete THEN
          completed_words := array_append(completed_words, prize_word);
          won_prizes := array_append(won_prizes, prize_config);
        END IF;
      END;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'quantity', quantity,
    'results', to_jsonb(results),
    'collected_letters', to_jsonb(collected_letters_arr),
    'completed_words', to_jsonb(completed_words),
    'won_prizes', to_jsonb(won_prizes)
  );
END;
$$;