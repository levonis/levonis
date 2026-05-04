CREATE OR REPLACE FUNCTION public.rf_offer_stock_summary(p_offer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_offer public.random_filament_offers;
  v_stock bigint := 0;
  v_sales bigint := 0;
  v_eligible_products bigint := 0;
  v_eligible_colors bigint := 0;
  v_has_whitelist boolean;
  v_cat_ids uuid[];
BEGIN
  SELECT * INTO v_offer FROM public.random_filament_offers WHERE id = p_offer_id;
  IF v_offer.id IS NULL THEN
    RETURN jsonb_build_object(
      'direct_stock_total',0,'sales_count',0,
      'eligible_products',0,'eligible_colors',0
    );
  END IF;

  v_has_whitelist := COALESCE(array_length(v_offer.allowed_product_ids,1),0) > 0;
  v_cat_ids := COALESCE(NULLIF(v_offer.category_ids,'{}'),
                       CASE WHEN v_offer.category_id IS NOT NULL THEN ARRAY[v_offer.category_id] ELSE '{}'::uuid[] END);

  IF v_offer.sale_type = 'direct' THEN
    -- Total stock units across eligible colors
    SELECT COALESCE(SUM(GREATEST(COALESCE(NULLIF(kv.value,'')::int, 0), 0)), 0)
      INTO v_stock
    FROM public.products p,
         jsonb_array_elements(COALESCE(p.colors::jsonb, '[]'::jsonb)) c,
         jsonb_each_text(COALESCE(c->'option_stocks','{}'::jsonb)) kv
    WHERE p.in_stock = true
      AND COALESCE((c->>'available_for_direct_sale')::boolean, false) = true
      AND (NOT v_has_whitelist OR p.id = ANY(v_offer.allowed_product_ids))
      AND (COALESCE(array_length(v_cat_ids,1),0) = 0 OR p.category_id = ANY(v_cat_ids));

    -- Eligible color rows (each color of each product with positive stock)
    SELECT COUNT(*) INTO v_eligible_colors
    FROM public.products p,
         jsonb_array_elements(COALESCE(p.colors::jsonb, '[]'::jsonb)) c
    WHERE p.in_stock = true
      AND COALESCE((c->>'available_for_direct_sale')::boolean, false) = true
      AND (NOT v_has_whitelist OR p.id = ANY(v_offer.allowed_product_ids))
      AND (COALESCE(array_length(v_cat_ids,1),0) = 0 OR p.category_id = ANY(v_cat_ids))
      AND EXISTS (
        SELECT 1 FROM jsonb_each_text(COALESCE(c->'option_stocks','{}'::jsonb)) kv
        WHERE GREATEST(COALESCE(NULLIF(kv.value,'')::int, 0), 0) > 0
      );

    -- Eligible distinct products (have at least one eligible color with stock)
    SELECT COUNT(DISTINCT p.id) INTO v_eligible_products
    FROM public.products p,
         jsonb_array_elements(COALESCE(p.colors::jsonb, '[]'::jsonb)) c
    WHERE p.in_stock = true
      AND COALESCE((c->>'available_for_direct_sale')::boolean, false) = true
      AND (NOT v_has_whitelist OR p.id = ANY(v_offer.allowed_product_ids))
      AND (COALESCE(array_length(v_cat_ids,1),0) = 0 OR p.category_id = ANY(v_cat_ids))
      AND EXISTS (
        SELECT 1 FROM jsonb_each_text(COALESCE(c->'option_stocks','{}'::jsonb)) kv
        WHERE GREATEST(COALESCE(NULLIF(kv.value,'')::int, 0), 0) > 0
      );
  ELSE
    -- Preorder: count whitelist or all category products with at least one preorder color/option
    SELECT COUNT(*) INTO v_eligible_products
    FROM public.products p
    WHERE (NOT v_has_whitelist OR p.id = ANY(v_offer.allowed_product_ids))
      AND (COALESCE(array_length(v_cat_ids,1),0) = 0 OR p.category_id = ANY(v_cat_ids));

    SELECT COALESCE(SUM(
      (SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(p.colors::jsonb,'[]'::jsonb)) c
       WHERE COALESCE((c->>'available_for_pre_order')::boolean, true) = true)
    ),0) INTO v_eligible_colors
    FROM public.products p
    WHERE (NOT v_has_whitelist OR p.id = ANY(v_offer.allowed_product_ids))
      AND (COALESCE(array_length(v_cat_ids,1),0) = 0 OR p.category_id = ANY(v_cat_ids));
  END IF;

  SELECT COUNT(*) INTO v_sales
  FROM public.random_filament_orders
  WHERE offer_id = p_offer_id;

  RETURN jsonb_build_object(
    'direct_stock_total', v_stock,
    'sales_count', v_sales,
    'eligible_products', v_eligible_products,
    'eligible_colors', v_eligible_colors
  );
END;
$function$;