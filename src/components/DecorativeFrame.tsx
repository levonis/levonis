import { useState, useEffect } from 'react';

const DecorativeFrame = () => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Defer loading the decorative frame to not block FCP
    // Use requestIdleCallback if available, otherwise fall back to setTimeout
    const hasIdleCallback = typeof window !== 'undefined' && 'requestIdleCallback' in window;
    
    let timerId: number;
    
    if (hasIdleCallback) {
      timerId = window.requestIdleCallback(() => setLoaded(true));
    } else {
      timerId = window.setTimeout(() => setLoaded(true), 100);
    }
    
    return () => {
      if (hasIdleCallback) {
        window.cancelIdleCallback(timerId);
      } else {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  if (!loaded) return null;

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-0 opacity-25"
      style={{
        backgroundImage: 'url(/images/decorative-frame-levonis.png)',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        mixBlendMode: 'multiply',
      }}
    />
  );
};

export default DecorativeFrame;
