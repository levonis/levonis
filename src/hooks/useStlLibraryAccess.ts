import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useActiveLevoCard } from './useActiveLevoCard';

/**
 * Eligibility for the STL Library:
 *  - approved merchant application
 *  - active (non-expired) Levo membership card
 */
export function useStlLibraryAccess() {
  const { user } = useAuth();
  const card = useActiveLevoCard();

  const merchantQ = useQuery({
    queryKey: ['stl-merchant-approved', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('merchant_applications')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .maybeSingle();
      return data || null;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const dailyLimitQ = useQuery({
    queryKey: ['stl-card-limit', card.data?.card_id],
    queryFn: async () => {
      if (!card.data?.card_id) return null;
      const { data } = await supabase
        .from('stl_card_download_limits')
        .select('daily_download_limit')
        .eq('card_id', card.data.card_id)
        .maybeSingle();
      return data?.daily_download_limit ?? null;
    },
    enabled: !!card.data?.card_id,
    staleTime: 60_000,
  });

  const todayCountQ = useQuery({
    queryKey: ['stl-today-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('stl_file_downloads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('downloaded_at', start.toISOString());
      return count ?? 0;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const isMerchant = !!merchantQ.data;
  const hasCard = !!card.data;
  const isEligible = isMerchant && hasCard;
  const dailyLimit = dailyLimitQ.data ?? null;
  const todayCount = todayCountQ.data ?? 0;
  const remaining = dailyLimit === null ? null : Math.max(0, dailyLimit - todayCount);

  return {
    user,
    isLoading: merchantQ.isLoading || card.isLoading,
    isMerchant,
    hasCard,
    card: card.data,
    isEligible,
    dailyLimit,
    todayCount,
    remaining,
  };
}
