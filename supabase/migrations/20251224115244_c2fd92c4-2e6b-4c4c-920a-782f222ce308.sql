-- Update redeem_letters_prize function to include telegram notifications
CREATE OR REPLACE FUNCTION public.redeem_letters_prize(p_competition_id uuid, p_word text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_profile record;
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
  v_redemption_id uuid;
  v_coupon_code text;
  v_product_id uuid;
  v_prize_value numeric;
  v_prize_name text;
  i int;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'يجب تسجيل الدخول');
  END IF;

  -- Get user profile for notification
  SELECT * INTO v_user_profile FROM profiles WHERE id = v_user_id;

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

  -- Extract prize info
  v_prize_name := v_prize_word->>'prize_name_ar';
  v_prize_value := COALESCE((v_prize_word->>'prize_value')::numeric, 0);
  v_product_id := (v_prize_word->>'product_id')::uuid;

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
    v_prize_name,
    v_prize_value,
    v_product_id,
    v_letters_to_use
  ) RETURNING id INTO v_redemption_id;

  -- Generate unique coupon code
  v_coupon_code := 'PRIZE-' || upper(substring(md5(random()::text) FROM 1 FOR 8));

  -- Create the coupon for this prize
  INSERT INTO letter_prize_coupons (
    user_id, competition_id, redemption_id, coupon_code, 
    prize_name_ar, prize_value, product_id, expires_at
  ) VALUES (
    v_user_id,
    p_competition_id,
    v_redemption_id,
    v_coupon_code,
    v_prize_name,
    v_prize_value,
    v_product_id,
    now() + interval '30 days'
  );

  -- Create notification for user
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    v_user_id,
    '🎉 مبروك! ربحت جائزة',
    'أكملت كلمة "' || p_word || '" وربحت: ' || v_prize_name || '. كود الخصم الخاص بك: ' || v_coupon_code,
    'success'
  );

  -- Create notification for all admins with full winner info
  INSERT INTO notifications (user_id, title, message, type)
  SELECT 
    ur.user_id,
    '🏆 فائز جديد في مسابقة الأحرف',
    'الفائز: ' || COALESCE(v_user_profile.full_name, v_user_profile.username, 'مستخدم') || 
    ' | الهاتف: ' || COALESCE(v_user_profile.phone_number, 'غير متوفر') ||
    ' | المحافظة: ' || COALESCE(v_user_profile.governorate, 'غير متوفر') ||
    ' | المسابقة: ' || v_competition.title_ar ||
    ' | الكلمة: "' || p_word || '"' ||
    ' | الجائزة: ' || v_prize_name ||
    CASE WHEN v_prize_value > 0 THEN ' (' || v_prize_value::text || ' دينار)' ELSE '' END ||
    ' | كود الخصم: ' || v_coupon_code,
    'info'
  FROM user_roles ur
  WHERE ur.role = 'admin';

  -- Return with flag to send telegram notifications
  RETURN jsonb_build_object(
    'success', true,
    'prize_name', v_prize_name,
    'prize_value', v_prize_value,
    'coupon_code', v_coupon_code,
    'letters_used', v_letters_to_use,
    'send_telegram', true,
    'user_name', COALESCE(v_user_profile.full_name, v_user_profile.username, 'مستخدم'),
    'user_phone', COALESCE(v_user_profile.phone_number, 'غير متوفر'),
    'user_governorate', COALESCE(v_user_profile.governorate, 'غير متوفر'),
    'competition_title', v_competition.title_ar
  );
END;
$$;