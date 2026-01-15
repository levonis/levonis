-- Add image_url to store_printers if not exists
ALTER TABLE store_printers ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create parts_discount_requests table for managing discount requests on spare parts
CREATE TABLE IF NOT EXISTS parts_discount_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  subscription_id UUID REFERENCES printer_subscriptions(id),
  product_id UUID REFERENCES products(id),
  order_id UUID REFERENCES orders(id),
  category_id UUID REFERENCES categories(id),
  original_price NUMERIC NOT NULL,
  discount_percentage NUMERIC NOT NULL,
  discounted_price NUMERIC NOT NULL,
  defect_description TEXT NOT NULL,
  defect_images TEXT[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'used')),
  admin_notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_parts_discount_requests_user ON parts_discount_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_parts_discount_requests_status ON parts_discount_requests(status);
CREATE INDEX IF NOT EXISTS idx_parts_discount_requests_subscription ON parts_discount_requests(subscription_id);

-- Enable RLS
ALTER TABLE parts_discount_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for parts_discount_requests
CREATE POLICY "Users can view their own discount requests"
  ON parts_discount_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create discount requests"
  ON parts_discount_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all discount requests"
  ON parts_discount_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.email LIKE '%@levonis%'
    )
  );

CREATE POLICY "Admins can update discount requests"
  ON parts_discount_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.email LIKE '%@levonis%'
    )
  );

-- Create subscription_usage_limits for tracking monthly limits
CREATE TABLE IF NOT EXISTS subscription_usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES printer_subscriptions(id) ON DELETE CASCADE,
  limit_type TEXT NOT NULL CHECK (limit_type IN ('parts_discount', 'service_request', 'maintenance')),
  used_count INTEGER NOT NULL DEFAULT 0,
  max_count INTEGER NOT NULL,
  reset_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(subscription_id, limit_type)
);

-- Enable RLS for subscription_usage_limits
ALTER TABLE subscription_usage_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own limits"
  ON subscription_usage_limits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM printer_subscriptions ps
      WHERE ps.id = subscription_usage_limits.subscription_id
      AND ps.user_id = auth.uid()
    )
  );

-- Add allowed_categories for parts discount in protection_plans
ALTER TABLE protection_plans ADD COLUMN IF NOT EXISTS parts_discount_categories UUID[];
ALTER TABLE protection_plans ADD COLUMN IF NOT EXISTS max_parts_discount_per_month INTEGER DEFAULT 2;