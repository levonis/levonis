import { memo, useState, useEffect } from 'react';

/**
 * DecorativeFrame - Lightweight decorative background
 * PERFORMANCE: Completely disabled on mobile devices to save RAM and improve LCP
 * Only loads on desktop after idle time to prevent blocking critical resources
 */
const DecorativeFrame = memo(() => {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // Skip entirely on mobile - no need to even check further
    if (typeof window === 'undefined' || window.innerWidth < 768) {
      return;
    }

    // Defer loading until browser is idle and after LCP
    const hasIdleCallback = 'requestIdleCallback' in window;
    
    // Wait for at least 3 seconds to ensure LCP is complete
    const delayTimer = window.setTimeout(() => {
      if (hasIdleCallback) {
        (window as any).requestIdleCallback(
          () => setShouldRender(true),
          { timeout: 5000 }
        );
      } else {
        setShouldRender(true);
      }
    }, 3000);
    
    return () => {
      window.clearTimeout(delayTimer);
    };
  }, []);

  // Don't render anything on mobile or before ready
  if (!shouldRender) return null;

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
