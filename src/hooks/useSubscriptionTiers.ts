import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SubTargetType = 'card' | 'protection_plan';

export interface SubscriptionDurationTier {
  id: string;
  target_type: SubTargetType;
  duration_months: number;
  discount_percentage: number;
  label_ar: string | null;
  label_en: string | null;
  label_ku: string | null;
  is_active: boolean;
  display_order: number;
}

export function useSubscriptionTiers(targetType: SubTargetType, includeInactive = false) {
  return useQuery({
    queryKey: ['subscription-duration-tiers', targetType, includeInactive],
    queryFn: async () => {
      let q = (supabase as any)
        .from('subscription_duration_tiers')
        .select('*')
        .eq('target_type', targetType)
        .order('duration_months', { ascending: true });
      if (!includeInactive) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as SubscriptionDurationTier[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
