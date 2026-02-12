import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Film, Play, Eye, Heart, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface MerchantReelsSectionProps {
  merchantId: string;
}

export default function MerchantReelsSection({ merchantId }: MerchantReelsSectionProps) {
  const queryClient = useQueryClient();
  const [selectedReel, setSelectedReel] = useState<any>(null);

  const { data: reels = [], isLoading } = useQuery({
    queryKey: ['merchant-reels-list', merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_reels')
        .select('id, video_url, thumbnail_url, caption, status, views_count, likes_count, saves_count, created_at, product:merchant_products!merchant_reels_product_id_fkey(title)')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('merchant_reels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-reels-list'] });
      toast.success('تم حذف الريل');
      setSelectedReel(null);
    },
  });

  const formatCount = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-500/20 text-green-700 text-[10px]">منشور</Badge>;
      case 'pending': return <Badge variant="outline" className="text-[10px]">قيد المراجعة</Badge>;
      case 'rejected': return <Badge variant="destructive" className="text-[10px]">مرفوض</Badge>;
      default: return null;
    }
  };

  if (isLoading) return null;

  return (
    <div className="space-y-4 mt-8">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Film className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">ريلزاتي</h2>
          <p className="text-xs text-muted-foreground">{reels.length} ريل</p>
        </div>
      </div>

      {reels.length === 0 ? (
        <Card className="border-border/50 p-8 rounded-2xl text-center">
          <Film className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">لم تنشر أي ريلز بعد</p>
        </Card>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {reels.map((reel) => (
            <div
              key={reel.id}
              className="relative aspect-[9/16] rounded-xl overflow-hidden bg-muted cursor-pointer group"
              onClick={() => setSelectedReel(reel)}
            >
              {reel.thumbnail_url ? (
                <img src={reel.thumbnail_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <video src={reel.video_url} className="w-full h-full object-cover" muted preload="metadata" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute top-1.5 right-1.5">{statusBadge(reel.status)}</div>
              <Play className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-2 text-white text-[10px]">
                <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{formatCount(reel.views_count)}</span>
                <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{formatCount(reel.likes_count)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reel Preview Dialog */}
      <Dialog open={!!selectedReel} onOpenChange={(v) => !v && setSelectedReel(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl bg-black">
          {selectedReel && (
            <div className="relative">
              <video
                src={selectedReel.video_url}
                className="w-full aspect-[9/16] object-contain bg-black"
                controls
                autoPlay
                playsInline
              />
              <div className="p-3 bg-card">
                <div className="flex items-center justify-between mb-2">
                  {statusBadge(selectedReel.status)}
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(selectedReel.created_at).toLocaleDateString('ar-IQ')}
                  </span>
                </div>
                {selectedReel.caption && (
                  <p className="text-sm mb-2" dir="rtl">{selectedReel.caption}</p>
                )}
                {selectedReel.product?.title && (
                  <p className="text-xs text-muted-foreground">المنتج: {selectedReel.product.title}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{selectedReel.views_count}</span>
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{selectedReel.likes_count}</span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full mt-3 gap-1"
                  onClick={() => deleteMutation.mutate(selectedReel.id)}
                >
                  <Trash2 className="w-3 h-3" />
                  حذف الريل
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
