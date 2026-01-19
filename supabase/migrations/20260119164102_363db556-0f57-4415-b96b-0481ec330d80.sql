-- Create cart_requests table for cart modification requests
CREATE TABLE public.cart_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    cart_code VARCHAR(20) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    original_total NUMERIC NOT NULL DEFAULT 0,
    adjusted_total NUMERIC,
    admin_notes TEXT,
    user_notes TEXT,
    cart_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    conversation_id UUID REFERENCES public.conversations(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cart_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for users to see their own cart requests
CREATE POLICY "Users can view their own cart requests" 
ON public.cart_requests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cart requests" 
ON public.cart_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Admins can view and update all cart requests (using user_roles table)
CREATE POLICY "Admins can view all cart requests" 
ON public.cart_requests 
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
));

CREATE POLICY "Admins can update all cart requests" 
ON public.cart_requests 
FOR UPDATE 
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
));

-- Create function to generate cart code
CREATE OR REPLACE FUNCTION public.generate_cart_code()
RETURNS VARCHAR(20) AS $$
DECLARE
    new_code VARCHAR(20);
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate a code like CART-123456
        new_code := 'CART-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        
        -- Check if code exists
        SELECT EXISTS(SELECT 1 FROM public.cart_requests WHERE cart_code = new_code) INTO code_exists;
        
        -- Exit loop if code doesn't exist
        EXIT WHEN NOT code_exists;
    END LOOP;
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for updated_at
CREATE TRIGGER update_cart_requests_updated_at
BEFORE UPDATE ON public.cart_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for cart_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.cart_requests;