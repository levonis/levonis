import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n';
import { resizeSupabaseImage } from '@/lib/imageUtils';

interface ReelThumb {
  id: string;
  thumbnail_url: string | null;
  video_url: string;
  caption: string | null;
  views_count: number;
  merchant_id: string;
}

export default function ReelsBar() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const { data: reels = [], isLoading } = useQuery({
    queryKey: ['home-reels-bar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_reels')
        .select('id, thumbnail_url, video_url, caption, views_count, merchant_id')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      const all = (data || []) as ReelThumb[];
      // Pin site/admin reels (no merchant_id) first
      const site = all.filter(r => !r.merchant_id);
      const merchant = all.filter(r => r.merchant_id);
      return [...site, ...merchant];
    },
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Reserve vertical space while loading to prevent CLS; only collapse if confirmed empty
  if (isLoading) {
    return <div className="w-full" style={{ minHeight: 230 }} aria-hidden="true" />;
  }
  if (reels.length === 0) return null;

  const formatCount = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  const openReels = () => navigate('/community/reels');

  return (
    <>
      <div className="w-full py-3">
        <div className="container mx-auto px-4 mb-2 flex items-center gap-2">
          <div className="w-1 h-4 bg-gradient-to-b from-primary to-accent rounded-full" />
          <h3 className="text-sm font-bold text-foreground">{t('section_reels_title')}</h3>
          <button
            onClick={() => navigate('/community/reels')}
            className="mr-auto text-[11px] text-primary font-medium hover:underline"
          >
            {t('section_view_all')}
          </button>
        </div>
        <div
          className="flex gap-2.5 overflow-x-auto scrollbar-hide px-4"
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
            overscrollBehaviorY: 'auto',
          }}
        >
          {reels.map((reel) => (
            <button
              key={reel.id}
              onClick={openReels}
              className="relative flex-shrink-0 w-[100px] h-[160px] md:w-[120px] md:h-[190px] rounded-xl overflow-hidden bg-muted group"
            >
              {reel.thumbnail_url ? (
                <img
                  src={resizeSupabaseImage(reel.thumbnail_url, 240, 60) || reel.thumbnail_url}
                  alt=""
                  className="w-full h-full object-cover pointer-events-none"
                  loading="lazy"
                  decoding="async"
                  width={120}
                  height={190}
                  draggable={false}
                />


              ) : (
                /* No thumbnail — show static gradient placeholder instead of
                   loading the full video (was costing 5+ MB per reel on home). */
                <div
                  className="w-full h-full bg-gradient-to-br from-primary/30 via-accent/20 to-primary/40 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Play className="w-8 h-8 text-white/70 fill-white/70" />
                </div>
              )}
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              {/* Play icon */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="w-4 h-4 text-white fill-white" />
              </div>
              {/* Views */}
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-white text-[9px]">
                <Play className="w-2.5 h-2.5 fill-white" />
                <span>{formatCount(reel.views_count)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

    </>
  );
}
