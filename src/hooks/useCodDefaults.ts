import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CodDefaults = { type: 'percentage' | 'fixed'; value: number } | null;

const QUERY_KEY = ['cod-default-settings-global'];

/**
 * Shared hook to fetch the global Cash-on-Delivery default settings.
 * Used to compute live `direct_sale_price` for products with
 * `link_direct_commission_to_cod` enabled, so prices on cards / cart /
 * product detail update instantly when admin changes the COD %.
 *
 * Subscribes to realtime changes on `default_settings` so any admin update
 * propagates without waiting for cache to expire.
 */
export function useCodDefaults() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('cod-defaults-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'default_settings',
          filter: 'setting_key=eq.partial_payment_settings',
        },
        () => {
          qc.invalidateQueries({ queryKey: QUERY_KEY });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return useQuery<CodDefaults>({
    queryKey: QUERY_KEY,
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
