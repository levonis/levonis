
CREATE OR REPLACE FUNCTION public.deduct_prize_stock(p_product_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product products%ROWTYPE;
BEGIN
  IF p_product_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  
  IF v_product.id IS NULL THEN
    RETURN false;
  END IF;

  -- If both stocks are NULL, treat as untracked inventory (allow prize without deduction)
  IF v_product.direct_stock IS NULL AND v_product.pre_order_stock IS NULL THEN
    RETURN true;
  END IF;

  -- Deduct from direct_stock if available
  IF v_product.direct_stock IS NOT NULL AND v_product.direct_stock > 0 THEN
    UPDATE products 
    SET direct_stock = direct_stock - 1,
        updated_at = now()
    WHERE id = p_product_id AND direct_stock > 0;
    RETURN true;
  END IF;

  -- Deduct from pre_order_stock as fallback
  IF v_product.pre_order_stock IS NOT NULL AND v_product.pre_order_stock > 0 THEN
    UPDATE products 
    SET pre_order_stock = pre_order_stock - 1,
        updated_at = now()
    WHERE id = p_product_id AND pre_order_stock > 0;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;
