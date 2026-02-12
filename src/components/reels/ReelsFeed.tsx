import { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2 } from 'lucide-react';
import { useReelsFeed } from '@/hooks/useReelsFeed';
import ReelCard from './ReelCard';

interface ReelsFeedProps {
  onClose: () => void;
}

export default function ReelsFeed({ onClose }: ReelsFeedProps) {
  const navigate = useNavigate();
  const { reels, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage, toggleInteraction, recordView } = useReelsFeed();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const index = Math.round(container.scrollTop / container.clientHeight);
    setActiveIndex(index);
    if (index >= reels.length - 3 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [reels.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleToggleInteraction = useCallback((reelId: string, type: 'like' | 'save') => {
    toggleInteraction.mutate({ reelId, type });
  }, [toggleInteraction]);

  const handleProductClick = useCallback((productId: string) => {
    onClose();
    // Navigate to community with product modal trigger
    navigate(`/community?tab=products&product=${productId}`);
  }, [navigate, onClose]);

  const handleMerchantClick = useCallback((merchantId: string) => {
    onClose();
    navigate(`/store/${merchantId}`);
  }, [navigate, onClose]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center gap-4">
        <button onClick={onClose} className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          <X className="w-5 h-5 text-white" />
        </button>
        <p className="text-white/70 text-lg font-medium">لا توجد ريلز حالياً</p>
        <p className="text-white/50 text-sm">سيتم إضافة محتوى قريباً</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      <div
        ref={containerRef}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {reels.map((reel, index) => (
          <div key={reel.id} className="w-full h-full snap-start snap-always" style={{ height: '100dvh' }}>
            <ReelCard
              reel={reel}
              isActive={index === activeIndex}
              isMuted={isMuted}
              onToggleMute={toggleMute}
              onToggleInteraction={handleToggleInteraction}
              onRecordView={recordView}
              onProductClick={handleProductClick}
              onMerchantClick={handleMerchantClick}
            />
          </div>
        ))}

        {isFetchingNextPage && (
          <div className="w-full h-20 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
