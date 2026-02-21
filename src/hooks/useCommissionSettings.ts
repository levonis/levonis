import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CommissionSettings {
  /** Platform commission rate taken from merchant (decimal, e.g. 0.017 = 1.7%) */
  platform_rate: number;
  /** Extra customer fee for half payment (percent, e.g. 5) */
  half_payment_fee: number;
  /** Extra customer fee for quarter payment (percent, e.g. 10) */
  quarter_payment_fee: number;
  /** Extra merchant fee for COD (percent, e.g. 10) */
  cod_merchant_fee: number;
  /** Fixed amount option fee (IQD) */
  fixed_amount_fee: number;
  /** Max debt before suspension (IQD) */
  max_debt_amount: number;
  /** Max debt days before suspension */
  max_debt_days: number;
  /** Whether COD is enabled */
  cod_enabled: boolean;
  /** Whether half payment is enabled */
  half_payment_enabled: boolean;
  /** Whether quarter payment is enabled */
  quarter_payment_enabled: boolean;
  /** Whether fixed amount is enabled */
  fixed_amount_enabled: boolean;
}

const DEFAULT_SETTINGS: CommissionSettings = {
  platform_rate: 0.017,
  half_payment_fee: 5,
  quarter_payment_fee: 10,
  cod_merchant_fee: 10,
  fixed_amount_fee: 0,
  max_debt_amount: 10000,
  max_debt_days: 3,
  cod_enabled: false,
  half_payment_enabled: true,
  quarter_payment_enabled: false,
  fixed_amount_enabled: false,
};

export function useCommissionSettings() {
  return useQuery({
    queryKey: ["commission-settings-full"],
    queryFn: async () => {
      // Fetch platform rate from default_settings
      const { data: platformData } = await supabase
        .from("default_settings")
        .select("setting_value")
        .eq("setting_key", "platform_commission_rate")
        .maybeSingle();

      // Fetch commission config from community_settings
      const { data: commissionData } = await supabase
        .from("community_settings")
        .select("value")
        .eq("key", "commission_config")
        .maybeSingle();

      const platformRate = (platformData?.setting_value as any)?.rate ?? DEFAULT_SETTINGS.platform_rate;
      const config = (commissionData?.value as Partial<CommissionSettings>) || {};

      return {
        ...DEFAULT_SETTINGS,
        ...config,
        platform_rate: platformRate,
      } as CommissionSettings;
    },
    staleTime: 60_000,
  });
}

export { DEFAULT_SETTINGS };
