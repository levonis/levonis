-- RPC function to enter instant win competition
CREATE OR REPLACE FUNCTION public.enter_instant_win_competition(comp_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id UUID;
  comp_record RECORD;
  ticket_count INTEGER;
  new_ticket_id UUID;
  new_ticket_number TEXT;
  is_winner BOOLEAN := false;
  won_prize JSONB := null;
  prize_tier JSONB;
  random_value NUMERIC;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  -- Get competition
  SELECT * INTO comp_record
  FROM competitions
  WHERE id = comp_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المسابقة غير متاحة');
  END IF;

  -- Check user ticket balance
  SELECT ticket_count INTO ticket_count
  FROM user_tickets
  WHERE user_id = current_user_id;

  IF ticket_count IS NULL OR ticket_count < comp_record.required_tickets THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يوجد تذاكر كافية');
  END IF;

  -- Deduct tickets
  UPDATE user_tickets
  SET ticket_count = user_tickets.ticket_count - comp_record.required_tickets,
      updated_at = now()
  WHERE user_id = current_user_id;

  -- Generate random number for win determination
  random_value := random() * 100;
  
  -- Check if winner based on probability
  IF comp_record.win_probability IS NOT NULL AND random_value <= comp_record.win_probability THEN
    is_winner := true;
    
    -- Select a prize tier if available
    IF comp_record.prize_tiers IS NOT NULL AND jsonb_array_length(comp_record.prize_tiers) > 0 THEN
      -- Simple random selection from prize tiers
      SELECT jsonb_array_element(comp_record.prize_tiers, floor(random() * jsonb_array_length(comp_record.prize_tiers))::int)
      INTO prize_tier;
      won_prize := prize_tier;
    ELSE
      won_prize := jsonb_build_object(
        'name_ar', comp_record.prize_description_ar,
        'value', comp_record.prize_value
      );
    END IF;
    
    -- Decrease remaining prizes if applicable
    IF comp_record.remaining_prizes IS NOT NULL AND comp_record.remaining_prizes > 0 THEN
      UPDATE competitions
      SET remaining_prizes = remaining_prizes - 1,
          updated_at = now()
      WHERE id = comp_id;
    END IF;
  END IF;

  -- Generate ticket number
  new_ticket_number := generate_ticket_number(comp_id);

  -- Create ticket with result
  INSERT INTO competition_tickets (
    competition_id, 
    user_id, 
    ticket_number, 
    is_winner,
    prize_won,
    revealed_at
  )
  VALUES (
    comp_id, 
    current_user_id, 
    new_ticket_number,
    is_winner,
    won_prize,
    now()
  )
  RETURNING id INTO new_ticket_id;

  -- Send notification
  IF is_winner THEN
    INSERT INTO notifications (user_id, title, message, type, related_id)
    VALUES (
      current_user_id,
      '🎉 مبروك! فزت في المسابقة!',
      'ربحت: ' || COALESCE(won_prize->>'name_ar', comp_record.prize_description_ar),
      'success',
      new_ticket_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', new_ticket_id,
    'ticket_number', new_ticket_number,
    'is_winner', is_winner,
    'prize', won_prize
  );
END;
$$;

-- RPC function for collect letters competition
CREATE OR REPLACE FUNCTION public.enter_collect_letters_competition(comp_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  awarded_letter TEXT;
  collected_letters_arr TEXT[];
  completed_words TEXT[] := ARRAY[]::TEXT[];
  won_prizes JSONB[] := ARRAY[]::JSONB[];
  prize_config JSONB;
  random_val NUMERIC;
  cumulative_prob NUMERIC;
  i INTEGER;
  letter_key TEXT;
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
  
  -- Get unique letters from target word
  SELECT ARRAY_AGG(DISTINCT letter) INTO available_letters
  FROM unnest(regexp_split_to_array(target_word, '')) AS letter
  WHERE letter != '';

  -- Deduct tickets
  UPDATE user_tickets
  SET ticket_count = user_tickets.ticket_count - comp_record.required_tickets,
      updated_at = now()
  WHERE user_id = current_user_id;

  -- Select random letter based on probabilities
  random_val := random() * 100;
  cumulative_prob := 0;
  awarded_letter := available_letters[1]; -- default
  
  IF letter_probs IS NOT NULL THEN
    FOR i IN 1..array_length(available_letters, 1) LOOP
      letter_key := available_letters[i];
      cumulative_prob := cumulative_prob + COALESCE((letter_probs->>letter_key)::NUMERIC, 100.0 / array_length(available_letters, 1));
      IF random_val <= cumulative_prob THEN
        awarded_letter := letter_key;
        EXIT;
      END IF;
    END LOOP;
  ELSE
    -- Equal probability
    awarded_letter := available_letters[1 + floor(random() * array_length(available_letters, 1))::int];
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
        SELECT ARRAY_AGG(DISTINCT l) INTO word_letters
        FROM unnest(regexp_split_to_array(prize_word, '')) AS l
        WHERE l != '';
        
        -- Check if user has all letters for this word
        FOREACH check_letter IN ARRAY word_letters
        LOOP
          IF NOT (check_letter = ANY(collected_letters_arr)) THEN
            has_all_letters := false;
            EXIT;
          END IF;
        END LOOP;
        
        IF has_all_letters THEN
          -- Check if not already won this prize
          IF NOT EXISTS (
            SELECT 1 FROM competition_tickets 
            WHERE user_id = current_user_id 
            AND competition_id = comp_id 
            AND is_winner = true
            AND prize_won->>'word' = prize_word
          ) THEN
            -- Mark as winner
            UPDATE competition_tickets
            SET is_winner = true, prize_won = prize_config
            WHERE id = new_ticket_id;
            
            completed_words := array_append(completed_words, prize_word);
            won_prizes := array_append(won_prizes, prize_config);
            
            -- Send notification
            INSERT INTO notifications (user_id, title, message, type, related_id)
            VALUES (
              current_user_id,
              '🎉 مبروك! أكملت كلمة ' || prize_word || '!',
              'ربحت: ' || COALESCE(prize_config->>'prize_name_ar', 'جائزة'),
              'success',
              new_ticket_id
            );
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
    'collected_letters', collected_letters_arr,
    'completed_words', completed_words,
    'won_prizes', won_prizes
  );
END;
$$;

-- RPC function for mystery box
CREATE OR REPLACE FUNCTION public.enter_mystery_box_competition(comp_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id UUID;
  comp_record RECORD;
  user_ticket_count INTEGER;
  new_ticket_id UUID;
  new_ticket_number TEXT;
  boxes_data JSONB;
  selected_box JSONB;
  random_val NUMERIC;
  cumulative_prob NUMERIC;
  box_item JSONB;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  -- Get competition
  SELECT * INTO comp_record
  FROM competitions
  WHERE id = comp_id AND status = 'active' AND competition_type = 'mystery_box';

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

  -- Deduct tickets
  UPDATE user_tickets
  SET ticket_count = user_tickets.ticket_count - comp_record.required_tickets,
      updated_at = now()
  WHERE user_id = current_user_id;

  -- Parse mystery boxes
  boxes_data := comp_record.mystery_boxes;
  
  -- Select random box based on probabilities
  random_val := random() * 100;
  cumulative_prob := 0;
  
  FOR box_item IN SELECT * FROM jsonb_array_elements(boxes_data)
  LOOP
    cumulative_prob := cumulative_prob + COALESCE((box_item->>'probability')::NUMERIC, 10);
    IF random_val <= cumulative_prob THEN
      selected_box := box_item;
      EXIT;
    END IF;
  END LOOP;
  
  -- Default to first box if none selected
  IF selected_box IS NULL AND boxes_data IS NOT NULL AND jsonb_array_length(boxes_data) > 0 THEN
    selected_box := boxes_data->0;
  END IF;

  -- Generate ticket number
  new_ticket_number := generate_ticket_number(comp_id);

  -- Create ticket
  INSERT INTO competition_tickets (
    competition_id, 
    user_id, 
    ticket_number,
    is_winner,
    prize_won,
    revealed_at
  )
  VALUES (
    comp_id, 
    current_user_id, 
    new_ticket_number,
    true,
    selected_box,
    now()
  )
  RETURNING id INTO new_ticket_id;

  -- Send notification
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    current_user_id,
    '📦 فتحت صندوقاً غامضاً!',
    'ربحت: ' || COALESCE(selected_box->>'name_ar', 'جائزة'),
    'success',
    new_ticket_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', new_ticket_id,
    'ticket_number', new_ticket_number,
    'prize', selected_box
  );
END;
$$;

-- RPC function for everyone wins (tiered prizes)
CREATE OR REPLACE FUNCTION public.enter_everyone_wins_competition(comp_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id UUID;
  comp_record RECORD;
  user_ticket_count INTEGER;
  new_ticket_id UUID;
  new_ticket_number TEXT;
  prize_tiers_data JSONB;
  selected_prize JSONB;
  random_val NUMERIC;
  cumulative_prob NUMERIC;
  tier_item JSONB;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  -- Get competition
  SELECT * INTO comp_record
  FROM competitions
  WHERE id = comp_id AND status = 'active' AND competition_type = 'everyone_wins';

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

  -- Deduct tickets
  UPDATE user_tickets
  SET ticket_count = user_tickets.ticket_count - comp_record.required_tickets,
      updated_at = now()
  WHERE user_id = current_user_id;

  -- Parse prize tiers
  prize_tiers_data := comp_record.prize_tiers;
  
  -- Select prize based on probabilities
  random_val := random() * 100;
  cumulative_prob := 0;
  
  FOR tier_item IN SELECT * FROM jsonb_array_elements(prize_tiers_data)
  LOOP
    cumulative_prob := cumulative_prob + COALESCE((tier_item->>'probability')::NUMERIC, 10);
    IF random_val <= cumulative_prob THEN
      selected_prize := tier_item;
      EXIT;
    END IF;
  END LOOP;
  
  -- Default to first tier if none selected
  IF selected_prize IS NULL AND prize_tiers_data IS NOT NULL AND jsonb_array_length(prize_tiers_data) > 0 THEN
    selected_prize := prize_tiers_data->0;
  END IF;

  -- Generate ticket number
  new_ticket_number := generate_ticket_number(comp_id);

  -- Create ticket
  INSERT INTO competition_tickets (
    competition_id, 
    user_id, 
    ticket_number,
    is_winner,
    prize_won,
    revealed_at
  )
  VALUES (
    comp_id, 
    current_user_id, 
    new_ticket_number,
    true,
    selected_prize,
    now()
  )
  RETURNING id INTO new_ticket_id;

  -- Send notification
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    current_user_id,
    '🎁 مبروك! ربحت جائزة!',
    'جائزتك: ' || COALESCE(selected_prize->>'name_ar', 'جائزة'),
    'success',
    new_ticket_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', new_ticket_id,
    'ticket_number', new_ticket_number,
    'prize', selected_prize
  );
END;
$$;

-- RPC function to purchase tickets with bundle bonuses
CREATE OR REPLACE FUNCTION public.purchase_tickets_with_bonus(
  ticket_quantity integer, 
  bonus_tickets integer,
  price_per_ticket numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  total_cost NUMERIC;
  current_balance NUMERIC;
  total_tickets INTEGER;
  new_ticket_count INTEGER;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'غير مسجل الدخول');
  END IF;

  total_cost := ticket_quantity * price_per_ticket;
  total_tickets := ticket_quantity + bonus_tickets;

  -- Get current wallet balance
  SELECT balance INTO current_balance
  FROM user_wallets
  WHERE user_id = current_user_id;

  IF current_balance IS NULL OR current_balance < total_cost THEN
    RETURN json_build_object('success', false, 'error', 'رصيد المحفظة غير كافي');
  END IF;

  -- Deduct from wallet
  UPDATE user_wallets
  SET balance = balance - total_cost,
      updated_at = now()
  WHERE user_id = current_user_id;

  -- Add tickets to user (including bonus)
  INSERT INTO user_tickets (user_id, ticket_count)
  VALUES (current_user_id, total_tickets)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    ticket_count = user_tickets.ticket_count + total_tickets,
    updated_at = now()
  RETURNING ticket_count INTO new_ticket_count;

  -- Record transaction
  INSERT INTO wallet_transactions (user_id, amount, type, status, admin_notes)
  VALUES (
    current_user_id, 
    -total_cost, 
    'purchase', 
    'completed', 
    'شراء ' || ticket_quantity || ' تذكرة + ' || bonus_tickets || ' هدية'
  );

  RETURN json_build_object(
    'success', true, 
    'new_ticket_count', new_ticket_count,
    'purchased', ticket_quantity,
    'bonus', bonus_tickets,
    'total_added', total_tickets
  );
END;
$$;