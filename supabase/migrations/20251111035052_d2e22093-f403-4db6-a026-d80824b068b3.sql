-- Add new columns to orders table for enhanced tracking
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS serial_number_image_url TEXT,
ADD COLUMN IF NOT EXISTS arrived_warehouse_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS arrived_iraq_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS user_confirmed_delivery BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS user_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_confirmed BOOLEAN DEFAULT FALSE;

-- Create function to auto-confirm delivery after 7 days
CREATE OR REPLACE FUNCTION auto_confirm_delivery()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-confirm orders that were delivered 7+ days ago and not confirmed by user
  UPDATE orders
  SET 
    user_confirmed_delivery = TRUE,
    auto_confirmed = TRUE,
    user_confirmed_at = NOW()
  WHERE 
    status = 'delivered'
    AND delivered_at IS NOT NULL
    AND delivered_at <= NOW() - INTERVAL '7 days'
    AND user_confirmed_delivery = FALSE;
    
  -- Auto-create 5-star reviews for auto-confirmed orders
  INSERT INTO reviews (product_id, user_id, rating, comment)
  SELECT DISTINCT 
    oi.product_id,
    o.user_id,
    5,
    'تقييم تلقائي - تم تأكيد الاستلام تلقائياً'
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  WHERE 
    o.auto_confirmed = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM reviews r 
      WHERE r.product_id = oi.product_id 
      AND r.user_id = o.user_id
    );
END;
$$;

-- Update order status options (note: we're still using the text field, just documenting the new values)
-- New status values: pending, confirmed, processing, arrived_warehouse, shipped, arrived_iraq, delivered, cancelled

COMMENT ON COLUMN orders.status IS 'Order status: pending, confirmed, processing, arrived_warehouse, shipped, arrived_iraq, delivered, cancelled';