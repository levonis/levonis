
UPDATE product_bundles SET original_price = sub.correct_original_price
FROM (
  SELECT pb.id,
    (SELECT SUM(
      bi.quantity * (
        COALESCE(p.original_price, p.price) + 
        ROUND(COALESCE(po.price_adjustment, 0) * 1500)
      )
    )
    FROM bundle_items bi
    JOIN products p ON p.id = bi.product_id
    LEFT JOIN product_options po ON po.id = bi.selected_option_id
    WHERE bi.bundle_id = pb.id) as correct_original_price
  FROM product_bundles pb
  WHERE pb.is_active = true
) sub
WHERE product_bundles.id = sub.id
