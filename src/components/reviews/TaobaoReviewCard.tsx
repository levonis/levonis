import { useState } from 'react';
import { Star, ChevronDown, ChevronUp, Play, ThumbsUp, Flag, Share2, Shield, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import ReviewImageViewer from './ReviewImageViewer';

interface ReviewData {
  id: string;
  rating: number;
  comment: string | null;
  media_files: string[] | null;
  video_url: string | null;
  created_at: string;
  user_id: string;
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

export default function TaobaoReviewCard({ review, isAdmin, currentUserId, onDelete }: TaobaoReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [liked, setLiked] = useState(false);

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

  return (
    <>
      <div className="py-4 border-b border-border/50 last:border-0">
        {/* User Info */}
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-9 w-9 ring-2 ring-orange-200/50">
            <AvatarImage src={avatar || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-orange-100 to-orange-50 text-orange-600 text-xs font-bold">
              {name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground truncate">{name}</span>
              <Badge className="h-4 px-1.5 text-[10px] font-bold bg-gradient-to-r from-amber-400 to-orange-400 text-white border-0 shadow-sm">
                VIP
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-3 w-3 ${s <= review.rating ? 'fill-orange-400 text-orange-400' : 'text-muted-foreground/30'}`}
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
                className="flex items-center gap-1 mt-1 text-xs font-medium text-orange-500 hover:text-orange-600 transition"
              >
                {expanded ? (
                  <>
                    عرض أقل <ChevronUp className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    عرض المزيد <ChevronDown className="h-3 w-3" />
                  </>
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
                className="relative aspect-square rounded-xl overflow-hidden bg-muted group"
              >
                {isVideo(url) ? (
                  <>
                    <video src={url} className="w-full h-full object-cover" muted preload="metadata" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition">
                      <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                        <Play className="h-4 w-4 text-foreground fill-foreground mr-[-2px]" />
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
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">+{allMedia.length - 6}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 text-xs gap-1 ${liked ? 'text-orange-500' : 'text-muted-foreground'}`}
            onClick={() => setLiked(!liked)}
          >
            <ThumbsUp className={`h-3 w-3 ${liked ? 'fill-orange-500' : ''}`} />
            مفيد
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground">
            <Share2 className="h-3 w-3" />
            مشاركة
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground">
            <Flag className="h-3 w-3" />
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
