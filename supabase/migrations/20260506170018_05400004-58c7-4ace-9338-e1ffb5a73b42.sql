ALTER TABLE public.user_cards
  ADD COLUMN IF NOT EXISTS last_notified_cycle_index integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.notify_user_card_activated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card_name text;
BEGIN
  BEGIN
    SELECT name_ar INTO v_card_name
    FROM public.membership_cards
    WHERE id = NEW.card_id;

    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (
      NEW.user_id,
      'تم تفعيل بطاقتك 🎉',
      'بطاقة ' || COALESCE(v_card_name, 'العضوية') || ' أصبحت فعّالة. الخصم والتوصيل المجاني متاحان لهذه الدورة.',
      'success',
      NEW.id
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  NEW.last_notified_cycle_index := 0;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_user_card_activated ON public.user_cards;
CREATE TRIGGER trg_notify_user_card_activated
BEFORE INSERT ON public.user_cards
FOR EACH ROW
EXECUTE FUNCTION public.notify_user_card_activated();

CREATE OR REPLACE FUNCTION public.notify_card_cycle_rollovers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_cycle record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT uc.id, uc.user_id, uc.card_id, uc.last_notified_cycle_index, mc.name_ar
    FROM public.user_cards uc
    JOIN public.membership_cards mc ON mc.id = uc.card_id
    WHERE uc.is_active = true
      AND (uc.expires_at IS NULL OR uc.expires_at > now())
      AND COALESCE(mc.duration_days, 30) > 0
  LOOP
    SELECT * INTO v_cycle FROM public.get_user_card_cycle(r.id) LIMIT 1;
    IF v_cycle.cycle_index IS NULL THEN CONTINUE; END IF;

    IF v_cycle.cycle_index > COALESCE(r.last_notified_cycle_index, 0) THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_id)
      VALUES (
        r.user_id,
        'دورة جديدة لبطاقتك 🔄',
        'بدأت دورة جديدة (' || (v_cycle.cycle_index + 1) || '/' || v_cycle.total_cycles ||
        ') لبطاقة ' || COALESCE(r.name_ar, 'العضوية') ||
        '. عاد سقف الخصم وعدد مرات التوصيل المجاني من جديد.',
        'success',
        r.id
      );
      UPDATE public.user_cards SET last_notified_cycle_index = v_cycle.cycle_index WHERE id = r.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

UPDATE public.user_cards uc
SET last_notified_cycle_index = COALESCE(
  (SELECT cycle_index FROM public.get_user_card_cycle(uc.id) LIMIT 1), 0
)
WHERE uc.is_active = true;

DO $$
DECLARE v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'notify-card-cycle-rollovers';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
  PERFORM cron.schedule(
    'notify-card-cycle-rollovers',
    '5 0 * * *',
    $cron$ SELECT public.notify_card_cycle_rollovers(); $cron$
  );
END $$;