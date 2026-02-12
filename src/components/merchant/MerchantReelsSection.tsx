import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Film, Play, Eye, Heart } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const ReelsFeed = lazy(() => import('@/components/reels/ReelsFeed'));

interface MerchantReelsSectionProps {
  merchantId: string;
}

export default function MerchantReelsSection({ merchantId }: MerchantReelsSectionProps) {
  const [showReelsViewer, setShowReelsViewer] = useState(false);

  const { data: reels = [], isLoading } = useQuery({
    queryKey: ['merchant-reels-list', merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_reels')
        .select('id, video_url, thumbnail_url, caption, status, views_count, likes_count, saves_count, created_at, product:merchant_products!merchant_reels_product_id_fkey(title)')
        .eq('merchant_id', merchantId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const formatCount = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  if (isLoading) return null;

  return (
    <>
      <div className="space-y-3">
        {reels.length === 0 ? (
          <Card className="border-border/50 p-8 rounded-2xl text-center">
            <Film className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">لا توجد ريلز</p>
          </Card>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {reels.map((reel) => (
              <div
                key={reel.id}
                className="relative aspect-[9/16] rounded-xl overflow-hidden bg-muted cursor-pointer group"
                onClick={() => setShowReelsViewer(true)}
              >
                {reel.thumbnail_url ? (
                  <img src={reel.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <video src={reel.video_url} className="w-full h-full object-cover" muted preload="metadata" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <Play className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-1.5 left-1.5 flex items-center gap-2 text-white text-[10px]">
                  <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{formatCount(reel.views_count)}</span>
                  <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{formatCount(reel.likes_count)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full-screen Reels Viewer */}
      {showReelsViewer && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        }>
          <ReelsFeed onClose={() => setShowReelsViewer(false)} />
        </Suspense>
      )}
    </>
  );
}
