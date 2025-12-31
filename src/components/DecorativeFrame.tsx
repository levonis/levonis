import { memo, useState, useEffect } from 'react';

/**
 * DecorativeFrame - Lightweight decorative background
 * PERFORMANCE: Disabled on mobile devices to save RAM
 */
const DecorativeFrame = memo(() => {
  const [loaded, setLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if mobile - disable decorative frame on mobile for performance
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    
    // Only load on desktop
    if (window.innerWidth >= 768) {
      const hasIdleCallback = typeof window !== 'undefined' && 'requestIdleCallback' in window;
      
      let timerId: number;
      
      if (hasIdleCallback) {
        timerId = window.requestIdleCallback(() => setLoaded(true), { timeout: 3000 });
      } else {
        timerId = window.setTimeout(() => setLoaded(true), 500);
      }
      
      return () => {
        if (hasIdleCallback) {
          window.cancelIdleCallback(timerId);
        } else {
          window.clearTimeout(timerId);
        }
      };
    }
  }, []);

  // Don't render on mobile - saves significant RAM
  if (isMobile || !loaded) return null;

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-0 opacity-10 hidden md:block"
      style={{
        backgroundImage: 'url(/images/decorative-frame-new.webp)',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        mixBlendMode: 'multiply',
        contain: 'strict',
        contentVisibility: 'auto',
        willChange: 'auto',
      }}
      aria-hidden="true"
    />
  );
});

DecorativeFrame.displayName = 'DecorativeFrame';

export default DecorativeFrame;
