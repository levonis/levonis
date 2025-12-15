import { memo, useState, useEffect } from 'react';

const DecorativeFrame = memo(() => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Defer loading the decorative frame to not block FCP
    const hasIdleCallback = typeof window !== 'undefined' && 'requestIdleCallback' in window;
    
    let timerId: number;
    
    if (hasIdleCallback) {
      timerId = window.requestIdleCallback(() => setLoaded(true), { timeout: 2000 });
    } else {
      timerId = window.setTimeout(() => setLoaded(true), 200);
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
      className="fixed inset-0 pointer-events-none z-0 opacity-20"
      style={{
        backgroundImage: 'url(/images/decorative-frame-levonis.png)',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        mixBlendMode: 'multiply',
        willChange: 'auto',
        contain: 'strict',
      }}
      aria-hidden="true"
    />
  );
});

DecorativeFrame.displayName = 'DecorativeFrame';

export default DecorativeFrame;
