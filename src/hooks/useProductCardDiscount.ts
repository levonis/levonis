import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ProductCardDiscountInfo {
  discountAmount: number;
  levelName: string;
  levelColor?: string;
}

/**
 * Hook to get active user card and calculate per-product discount.
 * Returns the active card level info so ProductCard can compute discount.
 */
export function useProductCardDiscount() {
  const { user } = useAuth();

  const { data: activeCard, isLoading } = useQuery({
    queryKey: ["user-active-card-product", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_cards")
        .select("id, level_id, loyalty_levels:level_id(id, name_ar, card_color)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const levelId = (activeCard?.loyalty_levels as any)?.id || null;
  const levelName = (activeCard?.loyalty_levels as any)?.name_ar || null;
  const levelColor = (activeCard?.loyalty_levels as any)?.card_color || null;

  /**
   * Calculate discount for a product given its card_discounts JSON array.
   */
  const getDiscount = (
    cardDiscounts: Array<{ level_id: string; discount_amount: number }> | null | undefined
  ): ProductCardDiscountInfo | null => {
    if (!levelId || !cardDiscounts || !Array.isArray(cardDiscounts)) return null;
    const match = cardDiscounts.find((d) => d.level_id === levelId);
    if (!match || match.discount_amount <= 0) return null;
    return {
      discountAmount: match.discount_amount,
      levelName: levelName || "",
      levelColor: levelColor || undefined,
    };
  };

  return { getDiscount, levelId, levelName, isLoading, hasCard: !!activeCard };
}
