import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useVipPlusStatus(userId: string | undefined) {
  return useQuery({
    queryKey: ["vip-plus-status", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("user_cards")
        .select("id, card_id, expires_at, membership_cards:card_id(is_vip_plus, free_daily_games, wholesale_discount_enabled, investment_enabled, priority_packaging, priority_support)")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      if (!data) return null;
      const card = (data as any).membership_cards;
      if (!card?.is_vip_plus) return null;
      return {
        isVipPlus: true,
        cardId: (data as any).id,
        expiresAt: (data as any).expires_at,
        freeDailyGames: card.free_daily_games || 0,
        wholesaleEnabled: card.wholesale_discount_enabled || false,
        investmentEnabled: card.investment_enabled || false,
        priorityPackaging: card.priority_packaging || false,
        prioritySupport: card.priority_support || false,
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useVipFreePlay(userId: string | undefined, _gameType: string) {
  return useQuery({
    queryKey: ["vip-free-play", userId, _gameType],
    queryFn: async () => {
      if (!userId) return { has_free_play: false };
      const { data, error } = await supabase.rpc("check_vip_free_play", {
        p_user_id: userId,
      });
      if (error) return { has_free_play: false };
      return { has_free_play: !!data };
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}
