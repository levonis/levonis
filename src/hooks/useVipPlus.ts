import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useVipPlusStatus(userId: string | undefined) {
  return useQuery({
    queryKey: ["vip-plus-status", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("user_cards")
        .select("id, level_id, expires_at, loyalty_levels:level_id(is_vip_plus, free_daily_games, wholesale_discount_enabled, investment_enabled, priority_packaging, priority_support)")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      if (!data) return null;
      const level = data.loyalty_levels as any;
      if (!level?.is_vip_plus) return null;
      return {
        isVipPlus: true,
        cardId: data.id,
        expiresAt: data.expires_at,
        freeDailyGames: level.free_daily_games || 0,
        wholesaleEnabled: level.wholesale_discount_enabled || false,
        investmentEnabled: level.investment_enabled || false,
        priorityPackaging: level.priority_packaging || false,
        prioritySupport: level.priority_support || false,
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useVipFreePlay(userId: string | undefined, gameType: string) {
  return useQuery({
    queryKey: ["vip-free-play", userId, gameType],
    queryFn: async () => {
      if (!userId) return { has_free_play: false };
      const { data, error } = await supabase.rpc("check_vip_free_play", {
        p_user_id: userId,
        p_game_type: gameType,
      });
      if (error) return { has_free_play: false };
      return data as { has_free_play: boolean; reason?: string; free_daily_games?: number };
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}
