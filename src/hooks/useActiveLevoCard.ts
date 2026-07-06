import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Checks if the current user has an active (non-expired) Levo membership card.
 */
export function useActiveLevoCard() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['active-levo-card', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('user_cards')
        .select('id, card_id, expires_at, is_active, membership_cards:card_id(name_ar, name_en, name_ku, card_key, cod_commission_discount_percentage, is_vip_plus)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order('expires_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}
