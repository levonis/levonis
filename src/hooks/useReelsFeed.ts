import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCallback, useRef } from 'react';

const PAGE_SIZE = 10;

export interface Reel {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  duration_seconds: number | null;
  views_count: number;
  likes_count: number;
  saves_count: number;
  clicks_count: number;
  is_sponsored: boolean;
  created_at: string;
  merchant: {
    id: string;
    display_name: string | null;
    store_image_url: string | null;
  } | null;
  product: {
    id: string;
    title: string;
    price_iqd: number | null;
    original_price_iqd: number | null;
    image_urls: string[] | null;
  } | null;
  siteProduct: {
    id: string;
    name_ar: string;
    slug: string;
    price: number | null;
    original_price: number | null;
    image_url: string | null;
  } | null;
  isLiked?: boolean;
  isSaved?: boolean;
}

export function useReelsFeed() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ['reels-feed', user?.id],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: reels, error } = await supabase
        .from('merchant_reels')
        .select(`
          id, video_url, thumbnail_url, caption, duration_seconds,
          views_count, likes_count, saves_count, clicks_count,
          is_sponsored, created_at, ranking_score,
          merchant:merchant_applications!merchant_reels_merchant_id_fkey(id, display_name, store_image_url),
          product:merchant_products!merchant_reels_product_id_fkey(id, title, price_iqd, original_price_iqd, image_urls),
          siteProduct:products!merchant_reels_site_product_id_fkey(id, name_ar, slug, price, original_price, image_url)
        `)
        .eq('status', 'approved')
        .order('ranking_score', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Fetch user interactions if logged in
      let interactions: { reel_id: string; interaction_type: string }[] = [];
      if (user?.id && reels?.length) {
        const { data: interData } = await supabase
          .from('reel_interactions')
          .select('reel_id, interaction_type')
          .eq('user_id', user.id)
          .in('reel_id', reels.map(r => r.id));
        interactions = interData || [];
      }

      const mapped = (reels || []).map(r => ({
        ...r,
        isLiked: interactions.some(i => i.reel_id === r.id && i.interaction_type === 'like'),
        isSaved: interactions.some(i => i.reel_id === r.id && i.interaction_type === 'save'),
      })) as Reel[];

      // Pin site/admin reels (no merchant_id) first
      const siteReels = mapped.filter(r => !r.merchant);
      const merchantReels = mapped.filter(r => r.merchant);
      return [...siteReels, ...merchantReels];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length;
    },
    initialPageParam: 0,
    staleTime: 2 * 60 * 1000,
  });

  const toggleInteraction = useMutation({
    mutationFn: async ({ reelId, type }: { reelId: string; type: 'like' | 'save' }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { data, error } = await supabase.rpc('toggle_reel_interaction', {
        p_reel_id: reelId,
        p_user_id: user.id,
        p_type: type,
      });
      if (error) throw error;
      return { reelId, type, added: data as boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reels-feed'] });
    },
  });

  const recordView = useCallback(async (
    reelId: string,
    watchDuration: number,
    completed: boolean,
    skippedEarly: boolean,
    clickedProduct: boolean
  ) => {
    try {
      await supabase.rpc('record_reel_view', {
        p_reel_id: reelId,
        p_user_id: user?.id || null,
        p_watch_duration: watchDuration,
        p_completed: completed,
        p_skipped_early: skippedEarly,
        p_clicked_product: clickedProduct,
      });
    } catch (e) {
      console.error('Failed to record view:', e);
    }
  }, [user?.id]);

  return {
    reels: query.data?.pages.flat() || [],
    isLoading: query.isLoading,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    toggleInteraction,
    recordView,
  };
}
