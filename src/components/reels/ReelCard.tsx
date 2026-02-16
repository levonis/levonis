import { memo, useRef, useEffect, useState, useCallback } from 'react';
import { Heart, Bookmark, Share2, ShoppingBag, Eye, Volume2, VolumeX, Play } from 'lucide-react';
import type { Reel } from '@/hooks/useReelsFeed';

interface ReelCardProps {
  reel: Reel;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onToggleInteraction: (reelId: string, type: 'like' | 'save') => void;
  onRecordView: (reelId: string, duration: number, completed: boolean, skippedEarly: boolean, clickedProduct: boolean) => void;
  onProductClick?: (productId: string) => void;
  onMerchantClick?: (merchantId: string) => void;
}

const ReelCard = memo(({ reel, isActive, isMuted, onToggleMute, onToggleInteraction, onRecordView, onProductClick, onMerchantClick }: ReelCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const watchStartRef = useRef<number>(0);
  const viewRecordedRef = useRef(false);

  // Sync mute state to video element
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = isMuted;
  }, [isMuted]);

  // Auto-play/pause based on active state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.currentTime = 0;
      // Ensure muted for autoplay (browser policy)
      video.muted = isMuted;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            // Retry muted if autoplay blocked
            video.muted = true;
            video.play()
              .then(() => setIsPlaying(true))
              .catch(() => setIsPlaying(false));
          });
      }
      watchStartRef.current = Date.now();
      viewRecordedRef.current = false;
    } else {
      video.pause();
      setIsPlaying(false);
      if (watchStartRef.current && !viewRecordedRef.current) {
        const duration = (Date.now() - watchStartRef.current) / 1000;
        const skippedEarly = duration < 3;
        onRecordView(reel.id, duration, false, skippedEarly, false);
        viewRecordedRef.current = true;
      }
    }
  }, [isActive, reel.id, onRecordView, isMuted]);

  const handleVideoEnd = useCallback(() => {
    if (!viewRecordedRef.current) {
      const duration = (Date.now() - watchStartRef.current) / 1000;
      onRecordView(reel.id, duration, true, false, false);
      viewRecordedRef.current = true;
    }
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.play();
    }
  }, [reel.id, onRecordView]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true));
    } else {
      video.pause();
      setIsPlaying(false);
    }
    setShowPlayIcon(true);
    setTimeout(() => setShowPlayIcon(false), 600);
  }, []);

  const handleProductClick = useCallback(() => {
    if (reel.product?.id) {
      if (!viewRecordedRef.current) {
        const duration = (Date.now() - watchStartRef.current) / 1000;
        onRecordView(reel.id, duration, false, false, true);
        viewRecordedRef.current = true;
      }
      onProductClick?.(reel.product.id);
    }
  }, [reel.product?.id, reel.id, onRecordView, onProductClick]);

  const formatCount = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  const discount = reel.product?.original_price_iqd && reel.product?.price_iqd
    ? Math.round((1 - reel.product.price_iqd / reel.product.original_price_iqd) * 100)
    : 0;

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      {/* Video - constrained to 9:16 */}
      <video
        ref={videoRef}
        src={reel.video_url}
        className="h-full max-w-full object-contain"
        style={{ aspectRatio: '9/16', maxHeight: '100dvh' }}
        muted={isMuted}
        playsInline
        loop={false}
        preload={isActive ? 'auto' : 'metadata'}
        poster={reel.thumbnail_url || undefined}
        onEnded={handleVideoEnd}
        onClick={togglePlay}
        crossOrigin="anonymous"
      />

      {/* Play icon overlay */}
      {showPlayIcon && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-16 h-16 rounded-full bg-black/40 flex items-center justify-center animate-ping-once">
            <Play className="w-8 h-8 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

      {/* Top badge - Sponsored */}
      {reel.is_sponsored && (
        <div className="absolute top-4 left-4 z-20">
          <span className="px-2 py-1 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-bold">
            إعلان مُموّل
          </span>
        </div>
      )}

      {/* Left side actions (RTL layout) */}
      <div className="absolute left-3 bottom-44 flex flex-col items-center gap-5 z-20">
        <button onClick={() => onToggleInteraction(reel.id, 'like')} className="flex flex-col items-center gap-1">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${reel.isLiked ? 'bg-red-500/20' : 'bg-white/10'} backdrop-blur-sm`}>
            <Heart className={`w-5 h-5 ${reel.isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
          </div>
          <span className="text-white text-[10px] font-medium">{formatCount(reel.likes_count)}</span>
        </button>

        <button onClick={() => onToggleInteraction(reel.id, 'save')} className="flex flex-col items-center gap-1">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${reel.isSaved ? 'bg-primary/20' : 'bg-white/10'} backdrop-blur-sm`}>
            <Bookmark className={`w-5 h-5 ${reel.isSaved ? 'fill-primary text-primary' : 'text-white'}`} />
          </div>
          <span className="text-white text-[10px] font-medium">{formatCount(reel.saves_count)}</span>
        </button>

        <button onClick={() => { if (navigator.share) navigator.share({ title: reel.caption || 'ريل', url: window.location.href }); }} className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-[10px] font-medium">مشاركة</span>
        </button>

        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <Eye className="w-4 h-4 text-white/70" />
          </div>
          <span className="text-white/70 text-[10px]">{formatCount(reel.views_count)}</span>
        </div>
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-0 right-0 left-14 p-4 z-20" dir="rtl">
        {/* Merchant info */}
        <div
          className="flex items-center gap-2 mb-3 cursor-pointer"
          onClick={() => reel.merchant?.id && onMerchantClick?.(reel.merchant.id)}
        >
          <div className="w-9 h-9 rounded-full border-2 border-primary overflow-hidden bg-card">
            {reel.merchant?.store_image_url ? (
              <img src={reel.merchant.store_image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-primary text-xs font-bold">
                {reel.merchant?.display_name?.[0] || '?'}
              </div>
            )}
          </div>
          <span className="text-white font-bold text-sm truncate">{reel.merchant?.display_name || 'تاجر'}</span>
        </div>

        {/* Caption */}
        {reel.caption && (
          <p className="text-white/90 text-sm mb-3 line-clamp-2" dir="rtl">{reel.caption}</p>
        )}

        {/* Product card */}
        {reel.product && (
          <button
            onClick={handleProductClick}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
          >
            {reel.product.image_urls?.[0] && (
              <img src={reel.product.image_urls[0]} alt={reel.product.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0 text-right">
              <p className="text-white font-bold text-xs truncate">{reel.product.title}</p>
              <div className="flex items-center gap-2 mt-1">
                {reel.product.price_iqd && (
                  <span className="text-primary font-black text-sm">{reel.product.price_iqd.toLocaleString()} د.ع</span>
                )}
                {discount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">-{discount}%</span>
                )}
              </div>
            </div>
            <div className="flex-shrink-0">
              <ShoppingBag className="w-5 h-5 text-primary" />
            </div>
          </button>
        )}
      </div>

      {/* Mute toggle */}
      <button
        onClick={onToggleMute}
        className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
      >
        {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
      </button>
    </div>
  );
});

ReelCard.displayName = 'ReelCard';
export default ReelCard;
