import { memo, useEffect, useState } from 'react';

/**
 * PageLoader - Premium loading animation
 * Shows a full-screen opaque loader that stays visible for a minimum duration
 * to prevent flash-of-loading and ensure smooth transitions.
 */
const PageLoader = memo(() => {
  const [visible, setVisible] = useState(true);

  // Ensure minimum display time of 400ms to avoid flicker
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-background">
      {/* Outer glow */}
      <div className="absolute w-32 h-32 rounded-full bg-primary/20 animate-loader-pulse" />
      
      {/* Middle ring */}
      <div className="absolute w-24 h-24 rounded-full border-2 border-primary/30 animate-loader-spin" />
      
      {/* Inner ring - counter rotation */}
      <div className="absolute w-16 h-16 rounded-full border-2 border-t-primary border-r-primary/40 border-b-primary/20 border-l-primary/60 animate-loader-spin-reverse" />
      
      {/* Center logo container */}
      <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-loader-breathe shadow-lg shadow-primary/30">
        <span className="text-primary-foreground font-bold text-lg">L</span>
      </div>
    </div>
  );
});

PageLoader.displayName = 'PageLoader';

export default PageLoader;
