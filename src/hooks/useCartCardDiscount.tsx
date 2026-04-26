import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { CartItem } from "./useCart";

export interface CardDiscountResult {
  totalDiscount: number;
  discountsByCategory: Record<string, { discount: number; limited: boolean; remaining: number; maxUses: number }>;
  levelName: string | null;
  levelId: string | null;
  cardId: string | null;
  hasDiscount: boolean;
  freeShipping: boolean;
  freeShippingMinOrder: number;
  freeShippingMethods: string[];
  freeShippingMaxUses: number | null;
  freeShippingUsedSoFar: number;
  freeShippingRemainingUses: number | null;
  // Percentage discount on subtotal (with optional cap during card validity)
  percentageDiscount: number;
  percentageRate: number;
  percentageMaxAmount: number | null;
  percentageUsedSoFar: number;
  percentageRemaining: number | null;
}

export function useCartCardDiscount(
  items: CartItem[],
  getItemPrice: (item: CartItem) => number,
  cartSubtotal: number
): { cardDiscount: CardDiscountResult | null; isLoading: boolean } {
  const { user } = useAuth();

  // Get user's active card with level info
  const { data: userCard, isLoading: loadingCard } = useQuery({
    queryKey: ["user-active-card-cart", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_cards")
        .select("id, level_id, purchased_at, loyalty_levels:level_id(id, name_ar, discount_percentage, discount_percentage_max_amount, free_shipping, free_shipping_min_order, free_shipping_methods, free_shipping_max_uses)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Get discount limits for user's card level
  const levelId = (userCard?.loyalty_levels as any)?.id;
  const { data: discountLimits, isLoading: loadingLimits } = useQuery({
    queryKey: ["card-discount-limits", levelId],
    queryFn: async () => {
      if (!levelId) return [];
      const { data, error } = await supabase
        .from("card_discount_limits")
        .select("*")
        .eq("level_id", levelId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!levelId,
    staleTime: 5 * 60 * 1000,
  });

  // Get discount usage for the current card
  const cardId = userCard?.id;
  const { data: discountUsage, isLoading: loadingUsage } = useQuery({
    queryKey: ["card-discount-usage", cardId],
    queryFn: async () => {
      if (!user || !cardId) return [];
      const { data, error } = await supabase
        .from("card_discount_usage")
        .select("category_id")
        .eq("user_id", user.id)
        .eq("card_id", cardId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!cardId,
    staleTime: 30 * 1000,
  });

  // Get cumulative percentage discount used during current card validity
  const { data: percentageUsedData, isLoading: loadingPercentageUsed } = useQuery({
    queryKey: ["card-percentage-discount-used", cardId],
    queryFn: async () => {
      if (!cardId) return 0;
      const { data, error } = await (supabase as any).rpc("get_card_percentage_discount_used", { p_card_id: cardId });
      if (error) throw error;
      return Number(data) || 0;
    },
    enabled: !!cardId,
    staleTime: 30 * 1000,
  });

  const isLoading = loadingCard || loadingLimits || loadingUsage || loadingPercentageUsed;

  if (!userCard || !levelId || isLoading) {
    return { cardDiscount: null, isLoading };
  }

  const level = userCard.loyalty_levels as any;
  if (!level) return { cardDiscount: null, isLoading: false };

  // Build usage count per category
  const usageByCategory: Record<string, number> = {};
  (discountUsage || []).forEach((u: any) => {
    usageByCategory[u.category_id] = (usageByCategory[u.category_id] || 0) + 1;
  });

  // Build limits map
  const limitsMap: Record<string, number> = {};
  (discountLimits || []).forEach((l: any) => {
    limitsMap[l.category_id] = l.max_uses;
  });

  // Calculate per-item discount using product's card_discounts JSON
  let totalDiscount = 0;
  const discountsByCategory: CardDiscountResult["discountsByCategory"] = {};

  for (const item of items) {
    if (!item.products || (item as any).is_gift) continue;
    const product = item.products as any;
    const categoryId = product.category_id;
    const cardDiscounts: Array<{ level_id: string; discount_amount: number }> = Array.isArray(product.card_discounts) ? product.card_discounts : [];

    // Find discount for this card level
    const match = cardDiscounts.find((d) => d.level_id === levelId);
    if (!match || match.discount_amount <= 0) continue;

    // Check category limit
    const maxUses = limitsMap[categoryId];
    const used = usageByCategory[categoryId] || 0;
    const isLimited = maxUses !== undefined;
    const remaining = isLimited ? Math.max(0, maxUses - used) : -1;

    if (isLimited && remaining <= 0) continue; // Limit reached for this category

    const itemDiscount = match.discount_amount * item.quantity;
    totalDiscount += itemDiscount;

    if (categoryId) {
      if (!discountsByCategory[categoryId]) {
        discountsByCategory[categoryId] = { discount: 0, limited: isLimited, remaining, maxUses: maxUses ?? -1 };
      }
      discountsByCategory[categoryId].discount += itemDiscount;
    }
  }

  // Percentage-based discount on the cart subtotal AFTER per-item discount
  const percentageRate = Number(level.discount_percentage) || 0;
  const percentageMaxAmount = level.discount_percentage_max_amount != null
    ? Number(level.discount_percentage_max_amount)
    : null;
  const percentageUsedSoFar = Number(percentageUsedData) || 0;
  const percentageRemaining = percentageMaxAmount != null
    ? Math.max(0, percentageMaxAmount - percentageUsedSoFar)
    : null;

  let percentageDiscount = 0;
  if (percentageRate > 0) {
    const baseAmount = Math.max(0, cartSubtotal - totalDiscount);
    const raw = Math.floor((baseAmount * percentageRate) / 100);
    percentageDiscount = percentageRemaining != null
      ? Math.min(raw, percentageRemaining)
      : raw;
  }

  // Free shipping check
  const freeShipping = level.free_shipping || false;
  const freeShippingMinOrder = level.free_shipping_min_order || 0;

  return {
    cardDiscount: {
      totalDiscount: totalDiscount + percentageDiscount,
      discountsByCategory,
      levelName: level.name_ar,
      levelId,
      cardId: cardId || null,
      hasDiscount: (totalDiscount + percentageDiscount) > 0,
      freeShipping,
      freeShippingMinOrder,
      percentageDiscount,
      percentageRate,
      percentageMaxAmount,
      percentageUsedSoFar,
      percentageRemaining,
    },
    isLoading: false,
  };
}
