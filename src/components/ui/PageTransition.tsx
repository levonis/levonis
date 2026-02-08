import { memo, ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * PageTransition - Wraps page content with smooth entrance animation
 * Uses CSS animations for performance (no JS animation libraries)
 */
const PageTransition = memo(({ children, className = '' }: PageTransitionProps) => {
  return (
    <div 
      className={`animate-page-enter ${className}`}
      style={{ 
        willChange: 'opacity, transform',
        contain: 'layout'
      }}
    >
      {children}
    </div>
  );
});

PageTransition.displayName = 'PageTransition';

export default PageTransition;
