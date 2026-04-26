import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CodDefaults = { type: 'percentage' | 'fixed'; value: number } | null;

/**
 * Shared hook to fetch the global Cash-on-Delivery default settings.
 * Used to compute live `direct_sale_price` for products with
 * `link_direct_commission_to_cod` enabled, so prices on cards / cart
 * update instantly when admin changes the COD %.
 */
export function useCodDefaults() {
  return useQuery<CodDefaults>({
    queryKey: ['cod-default-settings-global'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('default_settings')
        .select('setting_value')
        .eq('setting_key', 'partial_payment_settings')
        .single();
      const v: any = data?.setting_value || {};
      return {
        type: (v.cod_default_fee_type || 'percentage') as 'percentage' | 'fixed',
        value: Number(v.cod_default_fee_value) || 0,
      };
    },
  });
}
