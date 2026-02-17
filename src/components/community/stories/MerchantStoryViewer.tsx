import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Heart, Share2, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface MerchantStory {
  id: string;
  merchant_id: string;
  product_id: string | null;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  views_count: number;
  store_name: string;
  store_logo: string | null;
}

interface GroupedStories {
  merchant_id: string;
  store_name: string;
  store_logo: string | null;
  stories: MerchantStory[];
}

interface Props {
  groups: GroupedStories[];
  initialGroupIndex: number;
  onClose: () => void;
}

export default function MerchantStoryViewer({ groups, initialGroupIndex, onClose }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressRef = useRef(false);

  const currentGroup = groups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];
  const STORY_DURATION = 5000;

  // Fetch product if attached
  const { data: product } = useQuery<{ id: string; title: string; price_iqd: number | null; image_urls: string[] | null } | null>({
    queryKey: ['story-product', currentStory?.product_id],
    queryFn: async () => {
      if (!currentStory?.product_id) return null;
      const { data } = await supabase
        .from('merchant_products')
        .select('id, title, price_iqd, image_urls')
        .eq('id', currentStory.product_id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!currentStory?.product_id,
  });

  // Check if liked
  const { data: isLiked } = useQuery({
    queryKey: ['story-like', currentStory?.id, user?.id],
    queryFn: async () => {
      if (!user?.id || !currentStory?.id) return false;
      const { data } = await supabase
        .from('merchant_story_likes')
        .select('id')
        .eq('story_id', currentStory.id)
        .eq('user_id', user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id && !!currentStory?.id,
  });

  // Like count
  const { data: likeCount = 0 } = useQuery({
    queryKey: ['story-like-count', currentStory?.id],
    queryFn: async () => {
      if (!currentStory?.id) return 0;
      const { count } = await supabase
        .from('merchant_story_likes')
        .select('id', { count: 'exact', head: true })
        .eq('story_id', currentStory.id);
      return count || 0;
    },
    enabled: !!currentStory?.id,
  });

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!user?.id || !currentStory?.id) return;
      if (isLiked) {
        await supabase.from('merchant_story_likes').delete().eq('story_id', currentStory.id).eq('user_id', user.id);
      } else {
        await supabase.from('merchant_story_likes').insert({ story_id: currentStory.id, user_id: user.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-like', currentStory?.id] });
      queryClient.invalidateQueries({ queryKey: ['story-like-count', currentStory?.id] });
    },
  });

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(0);
    const step = 50;
    timerRef.current = setInterval(() => {
      if (longPressRef.current) return;
      setProgress(prev => {
        const next = prev + (step / STORY_DURATION) * 100;
        if (next >= 100) {
          goNext();
          return 0;
        }
        return next;
      });
    }, step);
  }, [groupIndex, storyIndex, groups]);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [groupIndex, storyIndex, startTimer]);

  const goNext = useCallback(() => {
    const group = groups[groupIndex];
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex(prev => prev + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex(prev => prev + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  }, [groupIndex, storyIndex, groups, onClose]);

  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(prev => prev - 1);
    } else if (groupIndex > 0) {
      setGroupIndex(prev => prev - 1);
      setStoryIndex(groups[groupIndex - 1].stories.length - 1);
    }
  }, [groupIndex, storyIndex, groups]);

  const handleTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) goPrev();
    else goNext();
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/store/${currentStory?.merchant_id}`;
    if (navigator.share) {
      await navigator.share({ title: currentGroup.store_name, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('تم نسخ الرابط');
    }
  };

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center" dir="ltr">
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-3 pt-3">
        {currentGroup.stories.map((_, idx) => (
          <div key={idx} className="flex-1 h-[3px] bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-none"
              style={{
                width: idx < storyIndex ? '100%' : idx === storyIndex ? `${progress}%` : '0%',
              }}
            />
          </div>
        ))}
      </div>

      {/* Header - store info */}
      <div className="absolute top-8 left-0 right-0 z-20 flex items-center justify-between px-4" dir="rtl">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-muted border-2 border-white/30">
            {currentGroup.store_logo ? (
              <img src={currentGroup.store_logo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm bg-primary/50">
                {currentGroup.store_name.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <p className="text-white text-sm font-bold">{currentGroup.store_name}</p>
            <p className="text-white/60 text-[10px]">
              {formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true, locale: ar })}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white p-1">
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Story content */}
      <div
        className="w-full h-full max-w-[420px] mx-auto relative cursor-pointer"
        onClick={handleTap}
        onMouseDown={() => { longPressRef.current = true; }}
        onMouseUp={() => { longPressRef.current = false; }}
        onTouchStart={() => { longPressRef.current = true; }}
        onTouchEnd={() => { longPressRef.current = false; }}
      >
        {currentStory.media_type === 'video' ? (
          <video
            key={currentStory.id}
            src={currentStory.media_url}
            className="w-full h-full object-contain"
            autoPlay
            muted
            playsInline
            preload="auto"
            onCanPlay={(e) => {
              const vid = e.currentTarget;
              vid.play().catch(() => {
                vid.muted = true;
                vid.play().catch(() => {});
              });
            }}
          />
        ) : (
          <img
            key={currentStory.id}
            src={currentStory.media_url}
            className="w-full h-full object-contain"
            alt=""
          />
        )}

        {/* Caption */}
        {currentStory.caption && (
          <div className="absolute bottom-32 left-4 right-4 z-20" dir="rtl">
            <p className="text-white text-sm font-medium bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
              {currentStory.caption}
            </p>
          </div>
        )}
      </div>

      {/* Bottom actions bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent pb-6 pt-12 px-4" dir="rtl">
        {/* Product card */}
        {product && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              navigate(`/store/${currentStory.merchant_id}`);
            }}
            className="w-full mb-4 flex items-center gap-3 bg-white/15 backdrop-blur-md rounded-2xl p-3 border border-white/20 hover:bg-white/25 transition-colors"
          >
            {product.image_urls && (product.image_urls as string[])[0] && (
              <img
                src={(product.image_urls as string[])[0]}
                alt=""
                className="w-14 h-14 rounded-xl object-cover shrink-0"
              />
            )}
            <div className="flex-1 text-right min-w-0">
              <p className="text-white text-sm font-bold truncate">{product.title}</p>
              <p className="text-white/80 text-xs mt-0.5">
                {product.price_iqd?.toLocaleString()} د.ع
              </p>
            </div>
            <ShoppingBag className="h-5 w-5 text-white/70 shrink-0" />
          </button>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={(e) => { e.stopPropagation(); toggleLike.mutate(); }}
            className="flex flex-col items-center gap-1"
          >
            <Heart
              className={`h-7 w-7 transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`}
            />
            {likeCount > 0 && (
              <span className="text-white/70 text-[10px]">{likeCount}</span>
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleShare(); }}
            className="flex flex-col items-center gap-1"
          >
            <Share2 className="h-6 w-6 text-white" />
          </button>
        </div>
      </div>

      {/* Nav arrows for desktop */}
      {groupIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-white/20 hover:bg-white/30 rounded-full p-2 hidden md:block"
        >
          <ChevronLeft className="h-5 w-5 text-white" />
        </button>
      )}
      {(groupIndex < groups.length - 1 || storyIndex < currentGroup.stories.length - 1) && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-white/20 hover:bg-white/30 rounded-full p-2 hidden md:block"
        >
          <ChevronRight className="h-5 w-5 text-white" />
        </button>
      )}
    </div>
  );
}
