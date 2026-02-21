import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CommissionSettings {
  platform_rate: number;
  half_payment_customer_fee: number;
  quarter_payment_customer_fee: number;
  cod_merchant_fee: number;
  fixed_amount_fee: number;
  debt_limit: number;
  debt_suspension_days: number;
}

const defaultSettings: CommissionSettings = {
  platform_rate: 0.017,
  half_payment_customer_fee: 5,
  quarter_payment_customer_fee: 10,
  cod_merchant_fee: 10,
  fixed_amount_fee: 0,
  debt_limit: 10000,
  debt_suspension_days: 3,
};

export function useCommissionSettings() {
  return useQuery({
    queryKey: ['commission-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('default_settings')
        .select('setting_value')
        .eq('setting_key', 'commission_settings')
        .maybeSingle();
      if (error) throw error;
      if (!data?.setting_value) return defaultSettings;
      return { ...defaultSettings, ...(data.setting_value as unknown as Partial<CommissionSettings>) };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export { defaultSettings };
