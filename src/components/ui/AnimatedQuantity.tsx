import { useEffect, useRef, useState } from 'react';

interface AnimatedQuantityProps {
  value: number;
  className?: string;
}

const AnimatedQuantity = ({ value, className = '' }: AnimatedQuantityProps) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [animating, setAnimating] = useState<'up' | 'down' | null>(null);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current === value) return;
    
    const direction = value > prevRef.current ? 'up' : 'down';
    setAnimating(direction);
    
    const timeout = setTimeout(() => {
      setDisplayValue(value);
      prevRef.current = value;
      setTimeout(() => setAnimating(null), 150);
    }, 100);

    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <span 
      className={`inline-block transition-all duration-200 ${className} ${
        animating === 'up' ? 'scale-125 text-primary' : 
        animating === 'down' ? 'scale-90 text-destructive' : 
        'scale-100'
      }`}
    >
      {displayValue}
    </span>
  );
};

export default AnimatedQuantity;
