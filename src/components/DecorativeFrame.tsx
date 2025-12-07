import { useState, useEffect } from 'react';

const DecorativeFrame = () => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Defer loading the decorative frame to not block FCP
    const timer = requestIdleCallback ? 
      requestIdleCallback(() => setLoaded(true)) : 
      setTimeout(() => setLoaded(true), 100);
    
    return () => {
      if (requestIdleCallback && typeof timer === 'number') {
        cancelIdleCallback(timer);
      } else {
        clearTimeout(timer as unknown as number);
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
