-- Function to update merchant monthly orders when a print_offer is completed
CREATE OR REPLACE FUNCTION public.update_merchant_monthly_orders()
RETURNS TRIGGER AS $$
DECLARE
  v_year_month TEXT;
  v_merchant_id UUID;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get the merchant_id from the print_offer
    v_merchant_id := NEW.merchant_id;
    
    -- Get current year-month
    v_year_month := TO_CHAR(NOW(), 'YYYY-MM');
    
    -- Upsert into merchant_monthly_orders
    INSERT INTO public.merchant_monthly_orders (merchant_id, year_month, completed_orders)
    VALUES (v_merchant_id, v_year_month, 1)
    ON CONFLICT (merchant_id, year_month)
    DO UPDATE SET 
      completed_orders = merchant_monthly_orders.completed_orders + 1,
      updated_at = NOW();
  END IF;
  
  -- Handle case when order is un-completed (status changed from completed to something else)
  IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
    v_merchant_id := NEW.merchant_id;
    v_year_month := TO_CHAR(NOW(), 'YYYY-MM');
    
    -- Decrement the count (but don't go below 0)
    UPDATE public.merchant_monthly_orders
    SET 
      completed_orders = GREATEST(0, completed_orders - 1),
      updated_at = NOW()
    WHERE merchant_id = v_merchant_id AND year_month = v_year_month;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on print_offers table
DROP TRIGGER IF EXISTS trigger_update_merchant_monthly_orders ON public.print_offers;

CREATE TRIGGER trigger_update_merchant_monthly_orders
AFTER INSERT OR UPDATE OF status ON public.print_offers
FOR EACH ROW
EXECUTE FUNCTION public.update_merchant_monthly_orders();