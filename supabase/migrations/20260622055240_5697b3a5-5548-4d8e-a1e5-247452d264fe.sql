DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.product_options; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.product_offers; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
ALTER TABLE public.product_options REPLICA IDENTITY FULL;
ALTER TABLE public.product_offers  REPLICA IDENTITY FULL;
ALTER TABLE public.products        REPLICA IDENTITY FULL;