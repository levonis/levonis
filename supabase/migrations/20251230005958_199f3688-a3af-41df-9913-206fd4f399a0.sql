-- 1) Track per-user listing views (throttled)
CREATE TABLE IF NOT EXISTS public.listing_views (
  user_id UUID NOT NULL,
  listing_id UUID NOT NULL REFERENCES public.user_listings(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

ALTER TABLE public.listing_views ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='listing_views' AND policyname='Users can view their own listing views'
  ) THEN
    CREATE POLICY "Users can view their own listing views"
    ON public.listing_views
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='listing_views' AND policyname='Users can insert their own listing views'
  ) THEN
    CREATE POLICY "Users can insert their own listing views"
    ON public.listing_views
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='listing_views' AND policyname='Users can update their own listing views'
  ) THEN
    CREATE POLICY "Users can update their own listing views"
    ON public.listing_views
    FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='listing_views' AND policyname='Users can delete their own listing views'
  ) THEN
    CREATE POLICY "Users can delete their own listing views"
    ON public.listing_views
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_listing_view(p_listing_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_viewed TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT last_viewed_at
  INTO v_last_viewed
  FROM public.listing_views
  WHERE user_id = auth.uid()
    AND listing_id = p_listing_id;

  IF v_last_viewed IS NULL OR v_last_viewed < now() - interval '10 minutes' THEN
    UPDATE public.user_listings
    SET views_count = COALESCE(views_count, 0) + 1
    WHERE id = p_listing_id
      AND status = 'approved';

    INSERT INTO public.listing_views (user_id, listing_id, last_viewed_at)
    VALUES (auth.uid(), p_listing_id, now())
    ON CONFLICT (user_id, listing_id)
    DO UPDATE SET last_viewed_at = EXCLUDED.last_viewed_at;
  END IF;
END;
$$;

-- 2) Allow marking marketplace messages as read + protect message immutability
CREATE OR REPLACE FUNCTION public.enforce_listing_message_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- admins can do anything
  IF has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- messages are immutable except is_read
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.image_url IS DISTINCT FROM OLD.image_url
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'listing_messages: only is_read can be updated';
  END IF;

  -- only allow setting to true (never unset)
  IF NEW.is_read IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'listing_messages: is_read can only be set to true';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_listing_message_update ON public.listing_messages;
CREATE TRIGGER trg_enforce_listing_message_update
BEFORE UPDATE ON public.listing_messages
FOR EACH ROW
EXECUTE FUNCTION public.enforce_listing_message_update();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='listing_messages' AND policyname='Participants can mark listing messages read'
  ) THEN
    CREATE POLICY "Participants can mark listing messages read"
    ON public.listing_messages
    FOR UPDATE
    USING (
      has_role(auth.uid(), 'admin'::public.app_role)
      OR (
        listing_messages.sender_id <> auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.listing_conversations c
          WHERE c.id = listing_messages.conversation_id
            AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
        )
      )
    )
    WITH CHECK (
      has_role(auth.uid(), 'admin'::public.app_role)
      OR (
        listing_messages.sender_id <> auth.uid()
        AND listing_messages.is_read = TRUE
        AND EXISTS (
          SELECT 1
          FROM public.listing_conversations c
          WHERE c.id = listing_messages.conversation_id
            AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
        )
      )
    );
  END IF;
END $$;