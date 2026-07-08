import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Checks if the current user OWNS a Levo membership card, regardless of
 * active status or subscription expiration. Used to gate access to
 * Bundles and Random Filament sections, which are unlocked by ownership only.
 */
export function useOwnedLevoCard() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['owned-levo-card', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_cards')
        .select('id, card_id, expires_at, is_active, membership_cards:card_id(name_ar, name_en, name_ku, card_key, cod_commission_discount_percentage, is_vip_plus)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}
