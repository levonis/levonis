import { useEffect, useRef, useState } from 'react';

interface AnimatedPriceProps {
  value: number;
  formatFn: (n: number) => string;
  className?: string;
  duration?: number;
}

const AnimatedPrice = ({ value, formatFn, className = '', duration = 400 }: AnimatedPriceProps) => {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const frameRef = useRef<number>();

  useEffect(() => {
    const prev = prevRef.current;
    if (prev === value) return;
    
    const start = performance.now();
    const diff = value - prev;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(prev + diff * eased));
      
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(value);
        prevRef.current = value;
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration]);

  // Sync on first render
  useEffect(() => {
    prevRef.current = value;
    setDisplay(value);
  }, []); // eslint-disable-line

  return <span className={className}>{formatFn(display)}</span>;
};

export default AnimatedPrice;
