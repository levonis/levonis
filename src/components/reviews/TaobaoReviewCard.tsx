import { useState } from 'react';
import { Star, ChevronDown, ChevronUp, Play, ThumbsUp, Flag, Share2, Trash2, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import ReviewImageViewer from './ReviewImageViewer';

interface AdditionalComment {
  comment: string;
  rating: number;
  date: string;
  media_files?: string[] | null;
  video_url?: string | null;
}

interface ReviewData {
  id: string;
  rating: number;
  comment: string | null;
  media_files: string[] | null;
  video_url: string | null;
  created_at: string;
  user_id: string;
  reorder_count?: number;
  additional_comments?: any;
  profiles?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

interface TaobaoReviewCardProps {
  review: ReviewData;
  isAdmin?: boolean;
  currentUserId?: string;
  onDelete?: (id: string) => void;
}

function parseAdditionalComments(val: any): AdditionalComment[] {
  if (!val) return [];
  if (Array.isArray(val)) return val as AdditionalComment[];
  try { return JSON.parse(val); } catch { return []; }
}

export default function TaobaoReviewCard({ review, isAdmin, currentUserId, onDelete }: TaobaoReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const name = review.profiles?.username || review.profiles?.full_name || 'مستخدم';
  const avatar = review.profiles?.avatar_url;
  const comment = review.comment || '';
  const isLong = comment.length > 150;
  const displayText = isLong && !expanded ? comment.slice(0, 150) + '...' : comment;

  const allMedia = [
    ...(review.media_files || []),
    ...(review.video_url ? [review.video_url] : []),
  ];

  const isVideo = (url: string) => /\.(mp4|webm|mov)$/i.test(url);

  const openViewer = (idx: number) => {
    setViewerIndex(idx);
    setViewerOpen(true);
  };

  const canDelete = isAdmin || (currentUserId && review.user_id === currentUserId);

  // Helpful query
  const { data: helpfulData } = useQuery({
    queryKey: ['review-helpful', review.id],
    queryFn: async () => {
      const [countRes, userRes] = await Promise.all([
        supabase.from('review_helpful').select('id', { count: 'exact' }).eq('review_id', review.id),
        user?.id
          ? supabase.from('review_helpful').select('id').eq('review_id', review.id).eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { count: countRes.count || 0, isHelpful: !!userRes.data };
    },
  });

  const helpfulMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('يجب تسجيل الدخول');
      if (helpfulData?.isHelpful) {
        await supabase.from('review_helpful').delete().eq('review_id', review.id).eq('user_id', user.id);
      } else {
        await supabase.from('review_helpful').insert({ review_id: review.id, user_id: user.id });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['review-helpful', review.id] }),
    onError: (err: Error) => toast.error(err.message),
  });

  // Report
  const reportMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('يجب تسجيل الدخول');
      const { error } = await supabase.from('review_reports').insert({ review_id: review.id, user_id: user.id, reason: 'محتوى غير لائق' });
      if (error) {
        if (error.code === '23505') throw new Error('تم الإبلاغ مسبقاً');
        throw error;
      }
    },
    onSuccess: () => toast.success('تم الإبلاغ بنجاح، شكراً لك'),
    onError: (err: Error) => toast.error(err.message),
  });

  // Share
  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'تقييم منتج', text: comment.slice(0, 100), url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('تم نسخ الرابط');
      }
    } catch { /* cancelled */ }
  };

  return (
    <>
      <div className="py-4 border-b border-border/20 last:border-0">
        {/* User Info */}
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-9 w-9 ring-2 ring-primary/30 shadow-[0_0_12px_hsl(var(--primary)/0.15)]">
            <AvatarImage src={avatar || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-xs font-bold backdrop-blur-sm">
              {name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground truncate">{name}</span>
              <Badge className="h-4 px-1.5 text-[10px] font-bold bg-gradient-to-r from-primary-glow to-primary text-primary-foreground border-0 shadow-[0_2px_8px_hsl(var(--primary)/0.25)]">
                VIP
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-3 w-3 ${s <= review.rating ? 'fill-primary text-primary' : 'text-muted-foreground/30'}`}
                  />
                ))}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: ar })}
              </span>
            </div>
          </div>
          {canDelete && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onDelete?.(review.id)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>

        {/* Review Text */}
        {comment && (
          <div className="mb-3">
            <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{displayText}</p>
            {isLong && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 mt-1 text-xs font-medium text-primary hover:text-primary-glow transition"
              >
                {expanded ? (
                  <>عرض أقل <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>عرض المزيد <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            )}
          </div>
        )}

        {/* Media Grid */}
        {allMedia.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {allMedia.slice(0, 6).map((url, idx) => (
              <button
                key={idx}
                onClick={() => openViewer(idx)}
                className="relative aspect-square rounded-xl overflow-hidden bg-background/50 group border border-border/20"
              >
                {isVideo(url) ? (
                  <>
                    <video src={url} className="w-full h-full object-cover" muted preload="metadata" />
                    <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] flex items-center justify-center group-hover:bg-background/50 transition">
                      <div className="w-8 h-8 rounded-full bg-primary/80 backdrop-blur-sm flex items-center justify-center shadow-[0_4px_16px_hsl(var(--primary)/0.3)]">
                        <Play className="h-4 w-4 text-primary-foreground fill-primary-foreground mr-[-2px]" />
                      </div>
                    </div>
                  </>
                ) : (
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                )}
                {idx === 5 && allMedia.length > 6 && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                    <span className="text-foreground font-bold text-lg">+{allMedia.length - 6}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Reorder Badge */}
        {(review.reorder_count || 1) > 1 && (
          <div className="mb-3 flex items-center gap-1.5">
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[11px] px-2 py-0.5 backdrop-blur-sm">
              🔄 تم إعادة الطلب {review.reorder_count} من المرات
            </Badge>
          </div>
        )}

        {/* Additional Comments */}
        {parseAdditionalComments(review.additional_comments).length > 0 && (
          <div className="mb-3 space-y-2">
            {parseAdditionalComments(review.additional_comments).map((ac, idx) => (
              <div key={idx} className="bg-background/30 backdrop-blur-sm rounded-xl p-3 border border-border/20">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-primary/30 text-primary">
                    تقييم إضافي #{idx + 1}
                  </Badge>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`h-2.5 w-2.5 ${s <= ac.rating ? 'fill-primary text-primary' : 'text-muted-foreground/30'}`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(ac.date), { addSuffix: true, locale: ar })}
                  </span>
                </div>
                {ac.comment && <p className="text-xs text-foreground/80">{ac.comment}</p>}
                {ac.media_files && ac.media_files.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {ac.media_files.map((url, i) => (
                      <img key={i} src={url} alt="" className="w-12 h-12 rounded-lg object-cover border border-border/20" loading="lazy" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 text-xs gap-1 ${helpfulData?.isHelpful ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => helpfulMutation.mutate()}
            disabled={helpfulMutation.isPending || !user}
          >
            {helpfulMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ThumbsUp className={`h-3 w-3 ${helpfulData?.isHelpful ? 'fill-primary' : ''}`} />
            )}
            مفيد {(helpfulData?.count || 0) > 0 && `(${helpfulData?.count})`}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-muted-foreground"
            onClick={handleShare}
          >
            <Share2 className="h-3 w-3" />
            مشاركة
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-muted-foreground"
            onClick={() => reportMutation.mutate()}
            disabled={reportMutation.isPending || !user}
          >
            {reportMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Flag className="h-3 w-3" />
            )}
            إبلاغ
          </Button>
        </div>
      </div>

      <ReviewImageViewer
        images={allMedia}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </>
  );
}
