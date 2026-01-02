-- Create RPC function to convert points to tickets
CREATE OR REPLACE FUNCTION public.convert_points_to_tickets(points_amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID;
  user_points_record RECORD;
  points_to_tickets_settings JSONB;
  points_per_ticket INTEGER;
  is_enabled BOOLEAN;
  tickets_to_add INTEGER;
  remaining_points INTEGER;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;
  
  -- Get settings
  SELECT setting_value INTO points_to_tickets_settings
  FROM default_settings
  WHERE setting_key = 'points_to_tickets';
  
  IF points_to_tickets_settings IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'إعدادات التحويل غير متوفرة');
  END IF;
  
  is_enabled := COALESCE((points_to_tickets_settings->>'enabled')::BOOLEAN, false);
  points_per_ticket := COALESCE((points_to_tickets_settings->>'points_per_ticket')::INTEGER, 100);
  
  IF NOT is_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'خدمة تحويل النقاط إلى تذاكر غير متاحة حالياً');
  END IF;
  
  IF points_amount < points_per_ticket THEN
    RETURN jsonb_build_object('success', false, 'error', 'الحد الأدنى للتحويل هو ' || points_per_ticket || ' نقطة');
  END IF;
  
  -- Get user points
  SELECT * INTO user_points_record
  FROM user_points
  WHERE user_id = current_user_id;
  
  IF NOT FOUND OR user_points_record.available_points < points_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'رصيد النقاط غير كافٍ');
  END IF;
  
  -- Calculate tickets
  tickets_to_add := FLOOR(points_amount / points_per_ticket);
  remaining_points := points_amount - (tickets_to_add * points_per_ticket);
  
  IF tickets_to_add <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'عدد النقاط غير كافٍ لتحويلها إلى تذكرة');
  END IF;
  
  -- Use exact points (rounded to match tickets)
  points_amount := tickets_to_add * points_per_ticket;
  
  -- Deduct points
  UPDATE user_points
  SET available_points = available_points - points_amount,
      redeemed_points = redeemed_points + points_amount,
      updated_at = now()
  WHERE user_id = current_user_id;
  
  -- Add tickets
  INSERT INTO user_tickets (user_id, ticket_count)
  VALUES (current_user_id, tickets_to_add)
  ON CONFLICT (user_id) DO UPDATE
  SET ticket_count = user_tickets.ticket_count + tickets_to_add,
      updated_at = now();
  
  -- Record transaction
  INSERT INTO points_transactions (user_id, points, type, source, description)
  VALUES (
    current_user_id,
    -points_amount,
    'redeemed',
    'tickets',
    'تحويل ' || points_amount || ' نقطة إلى ' || tickets_to_add || ' تذكرة'
  );
  
  -- Send notification
  INSERT INTO notifications (user_id, title, message, type, is_general)
  VALUES (
    current_user_id,
    '🎫 تم تحويل النقاط إلى تذاكر',
    'تم تحويل ' || points_amount || ' نقطة إلى ' || tickets_to_add || ' تذكرة بنجاح!',
    'success',
    false
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'points_used', points_amount,
    'tickets_added', tickets_to_add,
    'message', 'تم تحويل ' || points_amount || ' نقطة إلى ' || tickets_to_add || ' تذكرة بنجاح!'
  );
END;
$function$;

-- Create RPC function to award tickets from order value
CREATE OR REPLACE FUNCTION public.award_tickets_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  tickets_settings JSONB;
  amount_per_ticket NUMERIC;
  is_enabled BOOLEAN;
  tickets_to_add INTEGER;
BEGIN
  -- Only trigger when order is delivered
  IF OLD.status != 'delivered' AND NEW.status = 'delivered' THEN
    -- Get settings
    SELECT setting_value INTO tickets_settings
    FROM default_settings
    WHERE setting_key = 'tickets_from_purchases';
    
    IF tickets_settings IS NULL THEN
      RETURN NEW;
    END IF;
    
    is_enabled := COALESCE((tickets_settings->>'enabled')::BOOLEAN, false);
    amount_per_ticket := COALESCE((tickets_settings->>'amount_per_ticket')::NUMERIC, 25000);
    
    IF NOT is_enabled OR amount_per_ticket <= 0 THEN
      RETURN NEW;
    END IF;
    
    -- Calculate tickets
    tickets_to_add := FLOOR(NEW.total_amount / amount_per_ticket);
    
    IF tickets_to_add > 0 THEN
      -- Add tickets
      INSERT INTO user_tickets (user_id, ticket_count)
      VALUES (NEW.user_id, tickets_to_add)
      ON CONFLICT (user_id) DO UPDATE
      SET ticket_count = user_tickets.ticket_count + tickets_to_add,
          updated_at = now();
      
      -- Send notification
      INSERT INTO notifications (user_id, title, message, type, related_id, is_general)
      VALUES (
        NEW.user_id,
        '🎫 حصلت على تذاكر مجانية!',
        'تهانينا! حصلت على ' || tickets_to_add || ' تذكرة هدية لطلبك رقم ' || NEW.order_number,
        'success',
        NEW.id,
        false
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS award_tickets_on_delivery ON orders;
CREATE TRIGGER award_tickets_on_delivery
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION award_tickets_from_order();