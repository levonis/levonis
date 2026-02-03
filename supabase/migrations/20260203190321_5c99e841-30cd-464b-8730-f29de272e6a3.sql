-- Add email_notifications_enabled column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.email_notifications_enabled IS 'User preference for receiving email notifications';