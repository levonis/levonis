CREATE OR REPLACE FUNCTION public.complete_daily_task(task_key_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID;
  task_record RECORD;
  already_completed BOOLEAN;
  points_awarded NUMERIC;
  week_start DATE;
  week_end DATE;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  SELECT * INTO task_record
  FROM daily_tasks
  WHERE task_key = task_key_param AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المهمة غير موجودة');
  END IF;

  IF task_record.task_type = 'daily' THEN
    SELECT EXISTS(
      SELECT 1 FROM user_task_completions
      WHERE user_id = current_user_id
        AND task_key = task_key_param
        AND DATE(completed_at) = CURRENT_DATE
    ) INTO already_completed;
  ELSIF task_record.task_type = 'weekly' THEN
    -- نطاق الأسبوع من الأحد إلى السبت
    -- EXTRACT(DOW): الأحد=0, السبت=6
    week_start := CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::int;
    week_end := week_start + 6;
    SELECT EXISTS(
      SELECT 1 FROM user_task_completions
      WHERE user_id = current_user_id
        AND task_key = task_key_param
        AND DATE(completed_at) BETWEEN week_start AND week_end
    ) INTO already_completed;
  ELSIF task_record.task_type = 'once' THEN
    SELECT EXISTS(
      SELECT 1 FROM user_task_completions
      WHERE user_id = current_user_id
        AND task_key = task_key_param
    ) INTO already_completed;
  END IF;

  IF already_completed THEN
    RETURN jsonb_build_object('success', false, 'error', 'تم إكمال المهمة بالفعل');
  END IF;

  points_awarded := task_record.points_reward;

  INSERT INTO user_task_completions (user_id, task_key, points_earned)
  VALUES (current_user_id, task_key_param, points_awarded);

  INSERT INTO user_points (user_id, total_points, available_points)
  VALUES (current_user_id, points_awarded, points_awarded)
  ON CONFLICT (user_id) DO UPDATE
  SET
    total_points = user_points.total_points + points_awarded,
    available_points = user_points.available_points + points_awarded,
    updated_at = now();

  INSERT INTO points_transactions (user_id, points, type, source, description)
  VALUES (
    current_user_id,
    points_awarded,
    'earned',
    'daily_task',
    'مهمة: ' || task_record.title_ar
  );

  RETURN jsonb_build_object(
    'success', true,
    'points_earned', points_awarded,
    'task_title', task_record.title_ar
  );
END;
$function$;