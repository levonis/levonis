
-- Create user_listings table for 3rd party products
CREATE TABLE public.user_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description TEXT,
  description_ar TEXT,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'دينار عراقي',
  condition TEXT NOT NULL DEFAULT 'used', -- new, like_new, good, used, for_parts
  images TEXT[] DEFAULT ARRAY[]::TEXT[],
  category_id UUID REFERENCES public.categories(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, sold, expired
  admin_notes TEXT,
  shipping_method TEXT NOT NULL DEFAULT 'through_site', -- through_site, direct
  location TEXT,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create seller_profiles table for ratings and stats
CREATE TABLE public.seller_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  total_sales INTEGER DEFAULT 0,
  completed_orders INTEGER DEFAULT 0,
  average_rating NUMERIC DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create seller_reviews table
CREATE TABLE public.seller_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  listing_id UUID REFERENCES public.user_listings(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create listing_conversations table
CREATE TABLE public.listing_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.user_listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open, closed, disputed
  admin_joined BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create listing_messages table
CREATE TABLE public.listing_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.listing_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create listing_transactions table
CREATE TABLE public.listing_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.user_listings(id),
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  platform_fee NUMERIC DEFAULT 0,
  seller_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, shipped, delivered, completed, refunded, disputed
  shipping_method TEXT NOT NULL,
  shipping_address TEXT,
  phone_number TEXT,
  tracking_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create listing_fees_settings table
CREATE TABLE public.listing_fees_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fee_type TEXT NOT NULL DEFAULT 'percentage', -- fixed, percentage
  fee_value NUMERIC NOT NULL DEFAULT 5,
  min_fee NUMERIC DEFAULT 0,
  max_fee NUMERIC,
  terms_ar TEXT,
  terms_en TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default fee settings
INSERT INTO public.listing_fees_settings (fee_type, fee_value, terms_ar, terms_en)
VALUES ('percentage', 5, 'يتم خصم 5% من قيمة البيع كرسوم للمنصة', '5% platform fee will be deducted from the sale amount');

-- Enable RLS on all tables
ALTER TABLE public.user_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_fees_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_listings
CREATE POLICY "Anyone can view approved listings" ON public.user_listings FOR SELECT USING (status = 'approved');
CREATE POLICY "Sellers can view their own listings" ON public.user_listings FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "Admins can view all listings" ON public.user_listings FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Sellers can create listings" ON public.user_listings FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Sellers can update their own listings" ON public.user_listings FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Admins can update any listing" ON public.user_listings FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete listings" ON public.user_listings FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for seller_profiles
CREATE POLICY "Anyone can view seller profiles" ON public.seller_profiles FOR SELECT USING (true);
CREATE POLICY "Users can create their own profile" ON public.seller_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.seller_profiles FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for seller_reviews
CREATE POLICY "Anyone can view reviews" ON public.seller_reviews FOR SELECT USING (true);
CREATE POLICY "Buyers can create reviews" ON public.seller_reviews FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- RLS Policies for listing_conversations
CREATE POLICY "Participants can view their conversations" ON public.listing_conversations FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Admins can view all conversations" ON public.listing_conversations FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Buyers can create conversations" ON public.listing_conversations FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Participants can update conversations" ON public.listing_conversations FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Admins can update conversations" ON public.listing_conversations FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for listing_messages
CREATE POLICY "Participants can view messages" ON public.listing_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM listing_conversations WHERE id = conversation_id AND (buyer_id = auth.uid() OR seller_id = auth.uid()))
);
CREATE POLICY "Admins can view all messages" ON public.listing_messages FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Participants can send messages" ON public.listing_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (SELECT 1 FROM listing_conversations WHERE id = conversation_id AND (buyer_id = auth.uid() OR seller_id = auth.uid()))
);
CREATE POLICY "Admins can send messages" ON public.listing_messages FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for listing_transactions
CREATE POLICY "Participants can view their transactions" ON public.listing_transactions FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Admins can view all transactions" ON public.listing_transactions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Buyers can create transactions" ON public.listing_transactions FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Admins can update transactions" ON public.listing_transactions FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for listing_fees_settings
CREATE POLICY "Anyone can view fee settings" ON public.listing_fees_settings FOR SELECT USING (true);
CREATE POLICY "Only admins can manage fee settings" ON public.listing_fees_settings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to update seller stats after a completed sale
CREATE OR REPLACE FUNCTION public.update_seller_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO seller_profiles (user_id, completed_orders, total_sales)
    VALUES (NEW.seller_id, 1, 1)
    ON CONFLICT (user_id) DO UPDATE
    SET completed_orders = seller_profiles.completed_orders + 1,
        total_sales = seller_profiles.total_sales + 1,
        updated_at = now();
  END IF;
  RETURN NEW;
END;
$function$;

-- Trigger for updating seller stats
CREATE TRIGGER update_seller_stats_trigger
AFTER UPDATE ON public.listing_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_seller_stats();

-- Function to update seller rating
CREATE OR REPLACE FUNCTION public.update_seller_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  avg_rating NUMERIC;
  total_count INTEGER;
BEGIN
  SELECT AVG(rating), COUNT(*) INTO avg_rating, total_count
  FROM seller_reviews
  WHERE seller_id = NEW.seller_id;
  
  UPDATE seller_profiles
  SET average_rating = COALESCE(avg_rating, 0),
      total_reviews = total_count,
      updated_at = now()
  WHERE user_id = NEW.seller_id;
  
  RETURN NEW;
END;
$function$;

-- Trigger for updating seller rating
CREATE TRIGGER update_seller_rating_trigger
AFTER INSERT ON public.seller_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_seller_rating();

-- Enable realtime for conversations and messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.listing_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.listing_conversations;
