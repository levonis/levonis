-- Add admin management policies for game settings tables that are missing them

-- 1. Crossy Road Settings
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'crossy_road_settings' 
        AND policyname = 'Admins can manage crossy_road_settings'
    ) THEN
        CREATE POLICY "Admins can manage crossy_road_settings"
        ON public.crossy_road_settings
        FOR ALL
        TO authenticated
        USING (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;

-- 2. Space Blaster Settings
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'space_blaster_settings' 
        AND policyname = 'Admins can manage space_blaster_settings'
    ) THEN
        CREATE POLICY "Admins can manage space_blaster_settings"
        ON public.space_blaster_settings
        FOR ALL
        TO authenticated
        USING (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;

-- Ensure other game tables have similar policies if they were missed
-- Knife Rain
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'knife_rain_settings' 
        AND policyname = 'Admins can update knife_rain_settings'
    ) THEN
        CREATE POLICY "Admins can update knife_rain_settings"
        ON public.knife_rain_settings
        FOR UPDATE
        TO authenticated
        USING (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;
