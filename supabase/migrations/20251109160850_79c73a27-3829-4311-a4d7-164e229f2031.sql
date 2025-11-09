-- إنشاء جدول المهام اليومية
CREATE TABLE IF NOT EXISTS public.daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key TEXT UNIQUE NOT NULL,
  title_ar TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  icon TEXT NOT NULL,
  points_reward NUMERIC NOT NULL DEFAULT 0,
  task_type TEXT NOT NULL, -- 'daily', 'weekly', 'once'
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- إنشاء جدول إكمال المهام
CREATE TABLE IF NOT EXISTS public.user_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  points_earned NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- إنشاء جدول دعوات الأصدقاء
CREATE TABLE IF NOT EXISTS public.user_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'rewarded'
  points_awarded NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_user_task_completions_user_id ON public.user_task_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_task_key ON public.user_task_completions(task_key);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_completed_at ON public.user_task_completions(completed_at);
CREATE INDEX IF NOT EXISTS idx_user_referrals_referrer ON public.user_referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_user_referrals_code ON public.user_referrals(referral_code);

-- تفعيل RLS
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;

-- سياسات daily_tasks
CREATE POLICY "Anyone can view active tasks"
ON public.daily_tasks FOR SELECT
USING (is_active = true);

CREATE POLICY "Only admins can manage tasks"
ON public.daily_tasks FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- سياسات user_task_completions
CREATE POLICY "Users can view their own completions"
ON public.user_task_completions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own completions"
ON public.user_task_completions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all completions"
ON public.user_task_completions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- سياسات user_referrals
CREATE POLICY "Users can view their own referrals"
ON public.user_referrals FOR SELECT
USING (auth.uid() = referrer_user_id);

CREATE POLICY "Users can create referrals"
ON public.user_referrals FOR INSERT
WITH CHECK (auth.uid() = referrer_user_id);

CREATE POLICY "Admins can view all referrals"
ON public.user_referrals FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- دالة لتوليد كود دعوة فريد
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := 'REF-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    SELECT EXISTS(SELECT 1 FROM user_referrals WHERE referral_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$;

-- دالة لإكمال مهمة ومنح النقاط
CREATE OR REPLACE FUNCTION public.complete_daily_task(
  task_key_param TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_user_id UUID;
  task_record RECORD;
  already_completed BOOLEAN;
  points_awarded NUMERIC;
  result JSONB;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  -- جلب معلومات المهمة
  SELECT * INTO task_record
  FROM daily_tasks
  WHERE task_key = task_key_param AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المهمة غير موجودة');
  END IF;

  -- التحقق من عدم إكمال المهمة اليوم
  IF task_record.task_type = 'daily' THEN
    SELECT EXISTS(
      SELECT 1 FROM user_task_completions
      WHERE user_id = current_user_id
      AND task_key = task_key_param
      AND DATE(completed_at) = CURRENT_DATE
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

  -- تسجيل إكمال المهمة
  INSERT INTO user_task_completions (user_id, task_key, points_earned)
  VALUES (current_user_id, task_key_param, points_awarded);

  -- إضافة النقاط
  INSERT INTO user_points (user_id, total_points, available_points)
  VALUES (current_user_id, points_awarded, points_awarded)
  ON CONFLICT (user_id) DO UPDATE
  SET 
    total_points = user_points.total_points + points_awarded,
    available_points = user_points.available_points + points_awarded,
    updated_at = now();

  -- تسجيل المعاملة
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
$$;

-- إدراج المهام الافتراضية
INSERT INTO public.daily_tasks (task_key, title_ar, description_ar, icon, points_reward, task_type, display_order)
VALUES 
  ('daily_login', 'تسجيل الدخول اليومي', 'سجل دخولك كل يوم لتحصل على نقاط إضافية', 'LogIn', 5, 'daily', 1),
  ('share_product', 'مشاركة منتج', 'شارك منتج واحد على الأقل مع أصدقائك', 'Share2', 3, 'daily', 2),
  ('invite_friend', 'دعوة صديق', 'ادع صديقاً للتسجيل باستخدام كود الدعوة الخاص بك', 'UserPlus', 20, 'once', 3)
ON CONFLICT (task_key) DO NOTHING;

-- trigger لتحديث updated_at
CREATE TRIGGER update_daily_tasks_updated_at
BEFORE UPDATE ON public.daily_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();