import { useRef, useState, useCallback } from 'react';
import { Reply } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeableMessageProps {
  children: React.ReactNode;
  onSwipeReply: () => void;
  isMe: boolean;
  disabled?: boolean;
}

export default function SwipeableMessage({ children, onSwipeReply, isMe, disabled }: SwipeableMessageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDragging = useRef(false);
  const [translateX, setTranslateX] = useState(0);
  const [showReplyIcon, setShowReplyIcon] = useState(false);

  const THRESHOLD = 60;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    startXRef.current = e.touches[0].clientX;
    isDragging.current = true;
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || disabled) return;
    currentXRef.current = e.touches[0].clientX;
    // RTL: swipe left means negative delta
    const delta = currentXRef.current - startXRef.current;
    
    // Only allow left swipe (negative delta)
    if (delta > 0) {
      setTranslateX(0);
      setShowReplyIcon(false);
      return;
    }
    
    const clampedDelta = Math.max(delta, -100);
    setTranslateX(clampedDelta);
    setShowReplyIcon(Math.abs(clampedDelta) >= THRESHOLD);
  }, [disabled]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    if (Math.abs(translateX) >= THRESHOLD) {
      onSwipeReply();
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(30);
    }
    
    setTranslateX(0);
    setShowReplyIcon(false);
  }, [translateX, onSwipeReply]);

  return (
    <div className="relative overflow-hidden" ref={containerRef}>
      {/* Reply icon that appears on swipe */}
      <div className={cn(
        "absolute left-2 top-1/2 -translate-y-1/2 transition-all duration-150",
        showReplyIcon ? "opacity-100 scale-100" : "opacity-0 scale-75"
      )}>
        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
          <Reply className="h-4 w-4 text-primary" />
        </div>
      </div>
      
      <div
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging.current ? 'none' : 'transform 0.2s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
