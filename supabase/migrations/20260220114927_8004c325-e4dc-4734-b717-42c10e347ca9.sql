
-- Disable user triggers
ALTER TABLE public.listing_messages DISABLE TRIGGER prevent_message_tampering_trigger;
ALTER TABLE public.listing_messages DISABLE TRIGGER trg_enforce_listing_message_update;

-- Transfer messages from old support ID to new admin
UPDATE public.listing_messages SET sender_id = 'f632ba7b-60e7-4f2f-9cb7-2851f7f2ed2f' WHERE sender_id = '2ae7972f-6d1d-40fb-b73f-9fb72941f3f3';

-- Re-enable triggers
ALTER TABLE public.listing_messages ENABLE TRIGGER prevent_message_tampering_trigger;
ALTER TABLE public.listing_messages ENABLE TRIGGER trg_enforce_listing_message_update;
