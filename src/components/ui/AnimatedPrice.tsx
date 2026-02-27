import { useEffect, useRef, useState } from 'react';

interface AnimatedPriceProps {
  value: number;
  formatFn: (n: number) => string;
  className?: string;
  duration?: number;
}

const AnimatedPrice = ({ value, formatFn, className = '', duration = 400 }: AnimatedPriceProps) => {
  const safeValue = value ?? 0;
  const [display, setDisplay] = useState(safeValue);
  const prevRef = useRef(safeValue);
  const frameRef = useRef<number>();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev === safeValue) {
      setDisplay(safeValue);
      return;
    }

    // Cancel any running animation
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    
    const start = performance.now();
    const diff = safeValue - prev;

    const animate = (now: number) => {
      if (!mountedRef.current) return;
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(prev + diff * eased);
      setDisplay(current);
      
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(safeValue);
        prevRef.current = safeValue;
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [safeValue, duration]);

  // Always keep prevRef in sync when value settles
  useEffect(() => {
    prevRef.current = safeValue;
  }, [safeValue]);

  return <span className={className}>{formatFn(display)}</span>;
};

export default AnimatedPrice;
