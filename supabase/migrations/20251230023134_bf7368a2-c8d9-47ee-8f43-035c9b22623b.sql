-- Create user_blocks table for blocking between users
CREATE TABLE public.user_blocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (blocker_id, blocked_id)
);

-- Enable RLS
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_blocks
CREATE POLICY "Users can view their own blocks"
ON public.user_blocks FOR SELECT
USING (auth.uid() = blocker_id);

CREATE POLICY "Users can create blocks"
ON public.user_blocks FOR INSERT
WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can delete their own blocks"
ON public.user_blocks FOR DELETE
USING (auth.uid() = blocker_id);

-- Create user_warnings table for admin warnings
CREATE TABLE public.user_warnings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_id uuid NOT NULL,
    reason text NOT NULL,
    warning_type text NOT NULL DEFAULT 'warning', -- 'warning', 'final_warning', 'ban'
    is_active boolean NOT NULL DEFAULT true,
    expires_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_warnings
CREATE POLICY "Admins can manage warnings"
ON public.user_warnings FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own warnings"
ON public.user_warnings FOR SELECT
USING (auth.uid() = user_id);

-- Add is_banned column to profiles if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'is_banned'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN is_banned boolean DEFAULT false;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'ban_reason'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN ban_reason text;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'warnings_count'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN warnings_count integer DEFAULT 0;
    END IF;
END $$;

-- Create indexes
CREATE INDEX idx_user_blocks_blocker ON public.user_blocks(blocker_id);
CREATE INDEX idx_user_blocks_blocked ON public.user_blocks(blocked_id);
CREATE INDEX idx_user_warnings_user ON public.user_warnings(user_id);
CREATE INDEX idx_user_warnings_active ON public.user_warnings(is_active, user_id);