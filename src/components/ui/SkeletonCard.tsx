import { memo } from 'react';

/**
 * SkeletonCard - Product card loading placeholder
 * Matches ProductCard dimensions for zero layout shift
 */
const SkeletonCard = memo(() => {
  return (
    <div className="bg-card/50 rounded-lg p-1.5 border border-border/30 animate-skeleton-shimmer">
      {/* Image skeleton */}
      <div className="relative mb-1.5">
        <div className="aspect-square rounded-md bg-muted/30 skeleton-gradient" />
      </div>
      
      {/* Title skeleton */}
      <div className="h-3 w-3/4 rounded bg-muted/30 skeleton-gradient mb-1" />
      
      {/* Description skeleton */}
      <div className="h-2 w-1/2 rounded bg-muted/20 skeleton-gradient mb-1.5" />
      
      {/* Price row skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="h-4 w-16 rounded bg-primary/20 skeleton-gradient" />
          <div className="h-2 w-12 rounded bg-muted/20 skeleton-gradient" />
        </div>
        <div className="h-6 w-6 rounded-md bg-primary/20 skeleton-gradient" />
      </div>
    </div>
  );
});

SkeletonCard.displayName = 'SkeletonCard';

export default SkeletonCard;
