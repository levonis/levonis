
-- Table to store "notify me when available" requests
CREATE TABLE public.stock_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notified_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.stock_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" 
ON public.stock_notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notifications" 
ON public.stock_notifications FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" 
ON public.stock_notifications FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_stock_notifications_product ON public.stock_notifications(product_id);
CREATE INDEX idx_stock_notifications_user ON public.stock_notifications(user_id);
