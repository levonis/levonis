-- Add styling options to notifications table
ALTER TABLE public.notifications 
ADD COLUMN font_family TEXT DEFAULT 'Cairo',
ADD COLUMN text_color TEXT DEFAULT '#efe6c9',
ADD COLUMN background_color TEXT DEFAULT '#123f35';