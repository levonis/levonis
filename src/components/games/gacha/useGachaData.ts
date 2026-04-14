import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useGachaMachines() {
  return useQuery({
    queryKey: ["gacha-machines"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gacha_machines" as any)
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      return (data ?? []) as any[];
    },
  });
}

export function useGachaRarityTiers() {
  return useQuery({
    queryKey: ["gacha-rarity-tiers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gacha_rarity_tiers" as any)
        .select("*")
        .order("display_order");
      return (data ?? []) as any[];
    },
  });
}

export function useGachaMachinePrizes(machineId: string | null) {
  return useQuery({
    queryKey: ["gacha-machine-prizes", machineId],
    queryFn: async () => {
      if (!machineId) return [];
      const { data } = await supabase
        .from("gacha_machine_prizes" as any)
        .select("*, gacha_rarity_tiers(*)")
        .eq("machine_id", machineId)
        .eq("is_active", true);
      return (data ?? []) as any[];
    },
    enabled: !!machineId,
  });
}

export function useGachaSettings() {
  return useQuery({
    queryKey: ["gacha-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gacha_settings" as any)
        .select("*");
      const settings: Record<string, any> = {};
      (data ?? []).forEach((s: any) => { settings[s.key] = s.value; });
      return settings;
    },
  });
}

export function useUserGachaInventory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["gacha-inventory", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("gacha_user_inventory" as any)
        .select("*, gacha_dolls(*, gacha_rarity_tiers(*))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });
}

export function useUserGachaCoupons() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["gacha-user-coupons", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("gacha_user_coupons" as any)
        .select("*, gacha_coupons(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });
}

export function useUserSpinHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["gacha-spin-history", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("gacha_spins" as any)
        .select("*, gacha_machines(name_ar), gacha_rarity_tiers(name_ar, color)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(25);
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });
}

export function useGachaMarketplace() {
  return useQuery({
    queryKey: ["gacha-marketplace"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gacha_marketplace" as any)
        .select("*, gacha_dolls(*, gacha_rarity_tiers(*))")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(100);
      return (data ?? []) as any[];
    },
  });
}

export function useGachaDolls() {
  return useQuery({
    queryKey: ["gacha-dolls"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gacha_dolls" as any)
        .select("*, gacha_rarity_tiers(*)")
        .order("doll_number");
      return (data ?? []) as any[];
    },
  });
}

export function useGachaGuaranteedRules(machineId: string | null) {
  return useQuery({
    queryKey: ["gacha-guaranteed-rules", machineId],
    queryFn: async () => {
      if (!machineId) return [];
      const { data } = await supabase
        .from("gacha_guaranteed_rules" as any)
        .select("*")
        .eq("machine_id", machineId)
        .eq("is_active", true)
        .order("priority_order");
      return (data ?? []) as any[];
    },
    enabled: !!machineId,
  });
}
