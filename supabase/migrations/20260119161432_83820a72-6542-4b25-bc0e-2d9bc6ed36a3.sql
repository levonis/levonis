-- Create points_product_redemptions table to track user redemptions
CREATE TABLE IF NOT EXISTS public.points_product_redemptions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES public.points_redeemable_products(id) ON DELETE CASCADE,
    points_spent INTEGER NOT NULL,
    redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.points_product_redemptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own redemptions
CREATE POLICY "Users can view their own redemptions"
    ON public.points_product_redemptions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own redemptions
CREATE POLICY "Users can insert their own redemptions"
    ON public.points_product_redemptions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins can manage all redemptions
CREATE POLICY "Admins can manage all redemptions"
    ON public.points_product_redemptions
    FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role));

-- Add index for faster lookups
CREATE INDEX idx_points_product_redemptions_user ON public.points_product_redemptions(user_id);
CREATE INDEX idx_points_product_redemptions_product ON public.points_product_redemptions(product_id);