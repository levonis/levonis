import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import React from 'react';

const AnnouncementBar = () => {
  const [dismissed, setDismissed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const unitRef = useRef<HTMLDivElement>(null);
  const [repeats, setRepeats] = useState(15);

  const { data: announcements } = useQuery({
    queryKey: ['active-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  // Auto-rotate between announcements
  useEffect(() => {
    if (!announcements || announcements.length <= 1) return;
    const current = announcements[currentIndex];
    const autoRotate = current?.auto_rotate ?? true;
    const duration = (current?.display_duration || 5) * 1000;
    if (!autoRotate) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, duration);

    return () => clearInterval(interval);
  }, [announcements, currentIndex]);

  // Ensure the marquee never leaves empty space by repeating units to exceed container width
  useEffect(() => {
    const current = announcements?.[currentIndex];
    if (!current || !(current.always_move ?? false)) return;

    const recalc = () => {
      const cw = containerRef.current?.offsetWidth || 0;
      const uw = unitRef.current?.scrollWidth || 0;
      if (cw && uw) {
        // Calculate repeats needed to fill the container width
        const needed = Math.ceil(cw / uw) + 3;
        setRepeats(Math.max(needed, 15));
      }
    };

    recalc();
    const timer = setTimeout(recalc, 100);
    window.addEventListener('resize', recalc);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', recalc);
    };
  }, [announcements, currentIndex]);

  if (!announcements || announcements.length === 0 || dismissed) {
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
      className="text-white py-2 px-4 relative overflow-hidden transition-colors duration-500 -z-10"
      style={{ backgroundColor: bgColor }}
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
            <div className="relative h-full flex items-center">
              <div
                key={currentIndex}
                className="flex whitespace-nowrap will-change-transform"
                style={{
                  animation: direction === 'left' 
                    ? `marquee-scroll ${speed}s linear infinite` 
                    : `marquee-scroll-reverse ${speed}s linear infinite`,
                  gap: `${gap * 4}px`,
                }}
              >
                {/* Duplicate content twice for seamless infinite scroll */}
                {Array.from({ length: 2 }).map((_, groupIndex) => (
                  <div
                    key={groupIndex}
                    className="flex items-center"
                    style={{ gap: `${gap * 4}px`, paddingRight: `${gap * 4}px` }}
                    ref={groupIndex === 0 ? unitRef : null}
                  >
                    {Array.from({ length: repeats }).map((_, i) => (
                      <React.Fragment key={`${groupIndex}-${i}`}>
                        <span>{announcement.message_ar}</span>
                        <span className="opacity-60">•</span>
                      </React.Fragment>
                    ))}
                  </div>
                ))}
              </div>
              {/* Fade effect on edges */}
              <div 
                className="absolute inset-y-0 right-0 w-24 pointer-events-none z-10"
                style={{
                  background: `linear-gradient(to left, ${bgColor}, transparent)`
                }}
              />
              <div 
                className="absolute inset-y-0 left-0 w-24 pointer-events-none z-10"
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
};

export default AnnouncementBar;
