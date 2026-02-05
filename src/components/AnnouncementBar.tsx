import { memo, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';
import { useLocation } from 'react-router-dom';

interface AnnouncementBarProps {
  onHeightChange?: (height: number) => void;
  verificationBannerHeight?: number;
}

const AnnouncementBar = memo(({ onHeightChange, verificationBannerHeight = 0 }: AnnouncementBarProps) => {
  const [dismissed, setDismissed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const unitRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [repeats, setRepeats] = useState(4);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const location = useLocation();

  const { data: announcements } = useQuery({
    queryKey: ['active-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    refetchInterval: 120000,
    staleTime: 60000,
    gcTime: 300000,
  });

  // Report height changes
  useEffect(() => {
    if (!barRef.current || !onHeightChange) return;
    
    const updateHeight = () => {
      const height = barRef.current?.offsetHeight || 0;
      onHeightChange(dismissed ? 0 : height);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [dismissed, onHeightChange, announcements]);

  // Auto-rotate with cleanup
  useEffect(() => {
    if (!announcements || announcements.length <= 1) return;
    const current = announcements[currentIndex];
    const autoRotate = current?.auto_rotate ?? true;
    const duration = (current?.display_duration || 5) * 1000;
    if (!autoRotate) return;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, duration);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [announcements, currentIndex]);

  // Ensure the marquee repeats
  useEffect(() => {
    const current = announcements?.[currentIndex];
    if (!current || !(current.always_move ?? false)) return;

    let resizeTimeout: NodeJS.Timeout;
    const recalc = () => {
      const cw = containerRef.current?.offsetWidth || 0;
      const uw = unitRef.current?.scrollWidth || 0;
      if (cw && uw && uw > 0) {
        const isMobile = window.innerWidth < 768;
        const needed = Math.ceil((cw * 2) / uw) + 1;
        setRepeats(Math.min(needed, isMobile ? 3 : 6));
      }
    };

    recalc();
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(recalc, 200);
    };
    
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
    };
  }, [announcements, currentIndex]);

  // Only show on home page
  const isHomePage = location.pathname === '/';
  
  if (!isHomePage || !announcements || announcements.length === 0 || dismissed) {
    return null;
  }

  const announcement = announcements[currentIndex];
  const bgColor = announcement.color || '#3b82f6';
  const speed = announcement.speed || 20;
  const direction = announcement.direction || 'right';
  const alwaysMove = announcement.always_move ?? false;
  const gap = announcement.gap || 16;
  const hasMultiple = announcements.length > 1;

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + announcements.length) % announcements.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % announcements.length);
  };

  return (
    <div 
      ref={barRef}
      className="fixed left-0 right-0 z-[45] text-white py-2 px-3 overflow-hidden text-sm"
      style={{ backgroundColor: bgColor, top: `${verificationBannerHeight}px` }}
    >
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        {/* Previous button */}
        {hasMultiple && (
          <button
            onClick={goToPrevious}
            className="flex-shrink-0 hover:bg-white/20 rounded-full p-1 transition-colors"
            aria-label="السابق"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        <div className="flex-1 overflow-hidden relative" ref={containerRef}>
          {alwaysMove ? (
            <div className="relative h-full flex items-center overflow-hidden">
              <div
                key={currentIndex}
                className="flex whitespace-nowrap will-change-transform"
                style={{
                  animation: direction === 'left' 
                    ? `marquee-scroll ${speed}s linear infinite` 
                    : `marquee-scroll-reverse ${speed}s linear infinite`,
                }}
              >
                <div
                  className="flex items-center shrink-0"
                  style={{ gap: `${gap * 4}px` }}
                  ref={unitRef}
                >
                  {Array.from({ length: repeats }).map((_, i) => (
                    <React.Fragment key={i}>
                      <span className="shrink-0">{announcement.message_ar}</span>
                      <span className="opacity-60 shrink-0">•</span>
                    </React.Fragment>
                  ))}
                </div>
                <div
                  className="flex items-center shrink-0"
                  style={{ gap: `${gap * 4}px`, marginRight: `${gap * 4}px` }}
                >
                  {Array.from({ length: repeats }).map((_, i) => (
                    <React.Fragment key={`dup-${i}`}>
                      <span className="shrink-0">{announcement.message_ar}</span>
                      <span className="opacity-60 shrink-0">•</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div 
                className="absolute inset-y-0 right-0 w-16 pointer-events-none z-10"
                style={{
                  background: `linear-gradient(to left, ${bgColor}, transparent)`
                }}
              />
              <div 
                className="absolute inset-y-0 left-0 w-16 pointer-events-none z-10"
                style={{
                  background: `linear-gradient(to right, ${bgColor}, transparent)`
                }}
              />
            </div>
          ) : (
            <div 
              key={currentIndex}
              className="flex justify-center animate-fade-in"
            >
              <span className="inline-block">{announcement.message_ar}</span>
            </div>
          )}
        </div>

        {/* Next button */}
        {hasMultiple && (
          <button
            onClick={goToNext}
            className="flex-shrink-0 hover:bg-white/20 rounded-full p-1 transition-colors"
            aria-label="التالي"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        {/* Pagination dots */}
        {hasMultiple && (
          <div className="flex gap-1.5 flex-shrink-0">
            {announcements.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex 
                    ? 'bg-white w-6' 
                    : 'bg-white/40 hover:bg-white/60'
                }`}
                aria-label={`الإعلان ${index + 1}`}
              />
            ))}
          </div>
        )}
        
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 hover:bg-white/20 rounded-full p-1 transition-colors"
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

AnnouncementBar.displayName = 'AnnouncementBar';

export default AnnouncementBar;
