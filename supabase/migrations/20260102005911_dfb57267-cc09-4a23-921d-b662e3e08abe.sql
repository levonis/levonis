-- Fix the enter_collect_letters_competition function to handle NULL arrays properly
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
  bag_idx INTEGER;
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
    RETURN jsonb_build_object('success', false, 'error', 'إعدادات المسابقة غير مكتملة');
  END IF;
  
  target_word := COALESCE(letters_config_data->>'target_word', '');
  letter_probs := letters_config_data->'letter_probabilities';
  better_luck_prob := COALESCE((letters_config_data->>'better_luck_probability')::NUMERIC, 20);
  ticket_rewards := letters_config_data->'ticket_rewards';

  -- Validate target_word
  IF target_word = '' OR target_word IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'كلمة الهدف غير محددة في المسابقة');
  END IF;

  -- Get unique letters from target word
  SELECT ARRAY_AGG(DISTINCT letter) INTO available_letters
  FROM unnest(regexp_split_to_array(target_word, '')) AS letter
  WHERE letter != '' AND letter IS NOT NULL;

  -- Validate available_letters is not empty
  IF available_letters IS NULL OR array_length(available_letters, 1) IS NULL OR array_length(available_letters, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا توجد أحرف متاحة في كلمة الهدف');
  END IF;

  -- Get the count of letters for safe iteration
  letters_count := array_length(available_letters, 1);

  -- Deduct all tickets at once
  UPDATE user_tickets
  SET ticket_count = user_tickets.ticket_count - total_tickets_needed,
      updated_at = now()
  WHERE user_id = current_user_id;

  -- Calculate total probability of all letters
  total_letter_prob := 0;
  IF letter_probs IS NOT NULL AND letters_count > 0 THEN
    FOR i IN 1..letters_count LOOP
      letter_key := available_letters[i];
      letter_prob := COALESCE(NULLIF((letter_probs->>letter_key), '')::NUMERIC, 10);
      IF letter_prob < 0 THEN
        letter_prob := 0;
      END IF;
      total_letter_prob := total_letter_prob + letter_prob;
    END LOOP;
  ELSE
    -- Default: equal probability for each letter (10% each)
    total_letter_prob := letters_count * 10;
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
    
    -- Check for "better luck next time" first
    cumulative_prob := cumulative_prob + better_luck_prob;
    IF random_val <= cumulative_prob THEN
      is_better_luck := true;
    END IF;
    
    -- If not better luck, check for ticket rewards
    IF NOT is_better_luck AND ticket_rewards IS NOT NULL THEN
      FOR ticket_reward_item IN SELECT * FROM jsonb_array_elements(ticket_rewards)
      LOOP
        cumulative_prob := cumulative_prob + COALESCE((ticket_reward_item->>'probability')::NUMERIC, 0);
        IF random_val <= cumulative_prob THEN
          is_ticket_reward := true;
          awarded_tickets := COALESCE((ticket_reward_item->>'tickets')::INTEGER, 1);
          EXIT;
        END IF;
      END LOOP;
    END IF;
    
    -- If not better luck and not ticket reward, award a letter
    IF NOT is_better_luck AND NOT is_ticket_reward AND letters_count > 0 THEN
      FOR i IN 1..letters_count LOOP
        letter_key := available_letters[i];
        letter_prob := COALESCE(NULLIF((letter_probs->>letter_key), '')::NUMERIC, 10);
        IF letter_prob < 0 THEN
          letter_prob := 0;
        END IF;
        cumulative_prob := cumulative_prob + letter_prob;
        IF random_val <= cumulative_prob THEN
          awarded_letter := letter_key;
          EXIT;
        END IF;
      END LOOP;
      
      -- Fallback to random letter if none selected
      IF awarded_letter IS NULL THEN
        awarded_letter := available_letters[1 + floor(random() * letters_count)::INTEGER];
        -- Ensure valid index
        IF awarded_letter IS NULL THEN
          awarded_letter := available_letters[1];
        END IF;
      END IF;
    END IF;

    -- Generate ticket number
    new_ticket_number := 'L-' || substring(gen_random_uuid()::TEXT, 1, 8);

    -- Create competition ticket record
    INSERT INTO competition_tickets (
      competition_id,
      user_id,
      ticket_number,
      is_winner,
      letter_awarded,
      prize_won,
      revealed_at
    )
    VALUES (
      comp_id,
      current_user_id,
      new_ticket_number,
      false,
      awarded_letter,
      CASE 
        WHEN is_ticket_reward THEN jsonb_build_object('type', 'tickets', 'amount', awarded_tickets)
        ELSE NULL
      END,
      now()
    )
    RETURNING id INTO new_ticket_id;

    -- If a letter was awarded, add to collected letters (if new)
    IF awarded_letter IS NOT NULL AND NOT (awarded_letter = ANY(collected_letters_arr)) THEN
      INSERT INTO user_collected_letters (user_id, competition_id, letter)
      VALUES (current_user_id, comp_id, awarded_letter)
      ON CONFLICT (user_id, competition_id, letter) DO NOTHING;
      
      collected_letters_arr := array_append(collected_letters_arr, awarded_letter);
    END IF;

    -- If tickets were awarded, add them
    IF is_ticket_reward AND awarded_tickets > 0 THEN
      INSERT INTO user_tickets (user_id, ticket_count)
      VALUES (current_user_id, awarded_tickets)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        ticket_count = user_tickets.ticket_count + awarded_tickets,
        updated_at = now();
    END IF;

    -- Build result for this bag
    single_result := jsonb_build_object(
      'ticket_id', new_ticket_id,
      'ticket_number', new_ticket_number,
      'letter_awarded', awarded_letter,
      'is_better_luck', is_better_luck,
      'is_ticket_reward', is_ticket_reward,
      'tickets_awarded', awarded_tickets
    );
    
    results := array_append(results, single_result);
  END LOOP;

  -- Check for completed words
  IF letters_config_data->'prize_words' IS NOT NULL THEN
    FOR prize_config IN SELECT * FROM jsonb_array_elements(letters_config_data->'prize_words')
    LOOP
      DECLARE
        word_to_check TEXT;
        word_letters TEXT[];
        all_letters_collected BOOLEAN := true;
        word_letter TEXT;
      BEGIN
        word_to_check := prize_config->>'word';
        IF word_to_check IS NOT NULL AND word_to_check != '' THEN
          SELECT ARRAY_AGG(DISTINCT letter) INTO word_letters
          FROM unnest(regexp_split_to_array(word_to_check, '')) AS letter
          WHERE letter != '' AND letter IS NOT NULL;
          
          IF word_letters IS NOT NULL AND array_length(word_letters, 1) > 0 THEN
            FOREACH word_letter IN ARRAY word_letters
            LOOP
              IF NOT (word_letter = ANY(collected_letters_arr)) THEN
                all_letters_collected := false;
                EXIT;
              END IF;
            END LOOP;
            
            IF all_letters_collected THEN
              completed_words := array_append(completed_words, word_to_check);
              won_prizes := array_append(won_prizes, prize_config);
            END IF;
          END IF;
        END IF;
      END;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'results', to_jsonb(results),
    'collected_letters', to_jsonb(collected_letters_arr),
    'completed_words', to_jsonb(completed_words),
    'won_prizes', to_jsonb(won_prizes),
    'total_bags_opened', quantity
  );
END;
$$;