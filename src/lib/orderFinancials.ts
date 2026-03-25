type NullableNumber = number | null | undefined;

export interface FinancialProductSnapshot {
  price_usd?: NullableNumber;
  cost_price?: NullableNumber;
  other_costs_iqd?: NullableNumber;
}

export interface FinancialOrderItemSnapshot {
  quantity?: NullableNumber;
  cost_price?: NullableNumber;
  shipping_option_name_ar?: string | null;
  custom_request_id?: string | null;
  products?: FinancialProductSnapshot | null;
}

export interface FinancialOrderSnapshot {
  order_type?: string | null;
  order_items?: FinancialOrderItemSnapshot[] | null;
}

const toPositiveNumber = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
);

export const isDirectSaleLikeOrder = (order: FinancialOrderSnapshot): boolean => {
  if (order.order_type === 'direct') return true;
  if (order.order_type === 'preorder') return false;

  const items = order.order_items || [];
  if (!items.length) return false;

  return items.every((item) => (
    !item.custom_request_id &&
    (!item.shipping_option_name_ar || item.shipping_option_name_ar.includes('متاح في المخزون'))
  ));
};

export const getOrderItemProductCost = (
  order: FinancialOrderSnapshot,
  item: FinancialOrderItemSnapshot,
  usdToIqdRate: number,
): number => {
  const itemCostPrice = toPositiveNumber(item.cost_price);
  if (itemCostPrice > 0) return itemCostPrice;

  const productCostPrice = toPositiveNumber(item.products?.cost_price);
  if (productCostPrice > 0) return productCostPrice;

  const usdBaseCost = Math.round(toPositiveNumber(item.products?.price_usd) * toPositiveNumber(usdToIqdRate));
  const directExtraCosts = isDirectSaleLikeOrder(order)
    ? toPositiveNumber(item.products?.other_costs_iqd)
    : 0;

  return usdBaseCost + directExtraCosts;
};

export const calcAutoOrderProductCost = (
  order: FinancialOrderSnapshot,
  usdToIqdRate: number,
): number => {
  const items = order.order_items || [];

  return items.reduce((sum, item) => {
    const quantity = toPositiveNumber(item.quantity) || 1;
    return sum + (getOrderItemProductCost(order, item, usdToIqdRate) * quantity);
  }, 0);
};