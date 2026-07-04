import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CodTier = {
  min_amount: number;
  max_amount: number;
  cod_fee_type?: 'percentage' | 'fixed';
  cod_fee_value?: number;
};

export type CodDefaults =
  | {
      type: 'percentage' | 'fixed';
      value: number;
      /** Per-amount tiers from admin settings; preferred over `type/value` when present. */
      tiers?: CodTier[];
    }
  | null;

const QUERY_KEY = ['cod-default-settings-global'];

/**
 * Picks the COD tier matching the given order amount (IQD).
 * Falls back to the legacy default when no tier matches.
 */
export function pickCodForAmount(
  defaults: CodDefaults,
  amountIqd: number,
): { type: 'percentage' | 'fixed'; value: number } | null {
  if (!defaults) return null;
  const tiers = defaults.tiers;
  if (Array.isArray(tiers) && tiers.length > 0) {
    const t = tiers.find(
      (x) => amountIqd >= Number(x.min_amount || 0) && amountIqd <= Number(x.max_amount || 0),
    );
    if (t && t.cod_fee_value != null) {
      return {
        type: (t.cod_fee_type ?? 'percentage') as 'percentage' | 'fixed',
        value: Number(t.cod_fee_value) || 0,
      };
    }
  }
  return { type: defaults.type, value: defaults.value };
}

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
    // Unique channel name per hook instance — Supabase realtime forbids adding
    // callbacks to a channel after subscribe(), which fires when the same
    // channel name is reused across multiple mounted hook instances.
    const channelName = `cod-defaults-sync-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
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
      const tiers = Array.isArray(v.fee_tiers)
        ? v.fee_tiers.map((t: any) => ({
            min_amount: Number(t.min_amount) || 0,
            max_amount: Number(t.max_amount) || 0,
            cod_fee_type: (t.cod_fee_type ?? 'percentage') as 'percentage' | 'fixed',
            cod_fee_value: t.cod_fee_value == null ? undefined : Number(t.cod_fee_value) || 0,
          }))
        : undefined;
      return {
        type: (v.cod_default_fee_type || 'percentage') as 'percentage' | 'fixed',
        value: Number(v.cod_default_fee_value) || 0,
        tiers,
      };
    },
  });
}
