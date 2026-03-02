import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRef } from 'react';
import { Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ReelThumb {
  id: string;
  thumbnail_url: string | null;
  video_url: string;
  caption: string | null;
  views_count: number;
  merchant_id: string;
}

export default function ReelsBar() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: reels = [] } = useQuery({
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

  if (reels.length === 0) return null;

  const formatCount = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  return (
    <>
      <div className="w-full py-3">
        <div className="container mx-auto px-4 mb-2 flex items-center gap-2">
          <div className="w-1 h-4 bg-gradient-to-b from-primary to-accent rounded-full" />
          <h3 className="text-sm font-bold text-foreground">ريلز</h3>
          <button
            onClick={() => navigate('/community/reels')}
            className="mr-auto text-[11px] text-primary font-medium hover:underline"
          >
            عرض الكل
          </button>
        </div>
        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto scrollbar-hide px-4"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {reels.map((reel) => (
            <button
              key={reel.id}
              onClick={() => navigate('/community/reels')}
              className="relative flex-shrink-0 w-[100px] h-[160px] md:w-[120px] md:h-[190px] rounded-xl overflow-hidden bg-muted group"
            >
              {reel.thumbnail_url ? (
                <img
                  src={reel.thumbnail_url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <video
                  src={reel.video_url}
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                />
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
