
-- 1) Add columns
ALTER TABLE public.user_printers
  ADD COLUMN IF NOT EXISTS linked_card_id uuid REFERENCES public.user_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS card_link_grace_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_user_printers_linked_card ON public.user_printers(linked_card_id);

-- 2) Auto-link on insert
CREATE OR REPLACE FUNCTION public.auto_link_printer_to_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card_id uuid;
BEGIN
  IF NEW.linked_card_id IS NULL THEN
    SELECT id INTO v_card_id
    FROM public.user_cards
    WHERE user_id = NEW.user_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY expires_at DESC NULLS LAST
    LIMIT 1;

    IF v_card_id IS NOT NULL THEN
      NEW.linked_card_id := v_card_id;
      NEW.card_link_grace_until := NULL;
    ELSE
      -- 14-day grace period to obtain a card
      NEW.card_link_grace_until := COALESCE(NEW.card_link_grace_until, now() + interval '14 days');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_printer_to_card ON public.user_printers;
CREATE TRIGGER trg_auto_link_printer_to_card
BEFORE INSERT ON public.user_printers
FOR EACH ROW EXECUTE FUNCTION public.auto_link_printer_to_card();

-- 3) Validate update: linked card must belong to same user
CREATE OR REPLACE FUNCTION public.validate_printer_card_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.linked_card_id IS DISTINCT FROM OLD.linked_card_id
     AND NEW.linked_card_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_cards
      WHERE id = NEW.linked_card_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'linked_card_must_belong_to_same_user';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_printer_card_link ON public.user_printers;
CREATE TRIGGER trg_validate_printer_card_link
BEFORE UPDATE ON public.user_printers
FOR EACH ROW EXECUTE FUNCTION public.validate_printer_card_link();

-- 4) When user_cards is deactivated/deleted, keep printers but null the link and start grace
CREATE OR REPLACE FUNCTION public.on_user_card_deactivated_unlink_printers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.user_printers
    SET linked_card_id = NULL,
        card_link_grace_until = now() + interval '14 days',
        updated_at = now()
    WHERE linked_card_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE public.user_printers
    SET linked_card_id = NULL,
        card_link_grace_until = now() + interval '14 days',
        updated_at = now()
    WHERE linked_card_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_card_deactivated_unlink_printers ON public.user_cards;
CREATE TRIGGER trg_user_card_deactivated_unlink_printers
AFTER UPDATE OR DELETE ON public.user_cards
FOR EACH ROW EXECUTE FUNCTION public.on_user_card_deactivated_unlink_printers();

-- 5) RPC to re-link a printer to the user's currently active card
CREATE OR REPLACE FUNCTION public.relink_printer_to_active_card(_printer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_card uuid;
  v_owner uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT user_id INTO v_owner FROM public.user_printers WHERE id = _printer_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'printer_not_found'; END IF;
  IF v_owner <> v_user THEN RAISE EXCEPTION 'not_owner'; END IF;

  SELECT id INTO v_card
  FROM public.user_cards
  WHERE user_id = v_user
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY expires_at DESC NULLS LAST
  LIMIT 1;

  IF v_card IS NULL THEN RAISE EXCEPTION 'no_active_card'; END IF;

  UPDATE public.user_printers
  SET linked_card_id = v_card,
      card_link_grace_until = NULL,
      updated_at = now()
  WHERE id = _printer_id;

  RETURN v_card;
END;
$$;

GRANT EXECUTE ON FUNCTION public.relink_printer_to_active_card(uuid) TO authenticated;

-- 6) Backfill: link existing printers to owner's active card if any; otherwise grant 14-day grace
UPDATE public.user_printers up
SET linked_card_id = uc.id
FROM (
  SELECT DISTINCT ON (user_id) id, user_id
  FROM public.user_cards
  WHERE is_active = true AND (expires_at IS NULL OR expires_at > now())
  ORDER BY user_id, expires_at DESC NULLS LAST
) uc
WHERE up.user_id = uc.user_id
  AND up.linked_card_id IS NULL;

UPDATE public.user_printers
SET card_link_grace_until = now() + interval '14 days'
WHERE linked_card_id IS NULL
  AND card_link_grace_until IS NULL;
