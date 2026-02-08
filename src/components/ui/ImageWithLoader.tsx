import { memo, useState, useCallback } from 'react';

interface ImageWithLoaderProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  quality?: number; // 1-100, default 75
}

/**
 * ImageWithLoader - Image with loading animation and compression hints
 * Uses native lazy loading + quality hints for smaller file sizes
 */
const ImageWithLoader = memo(({ 
  src, 
  alt, 
  className = '',
  containerClassName = '',
  priority = false,
  width,
  height,
  quality = 75
}: ImageWithLoaderProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoaded(true);
  }, []);

  // Add quality parameter to Supabase storage URLs
  const optimizedSrc = src?.includes('supabase.co/storage') 
    ? `${src}${src.includes('?') ? '&' : '?'}quality=${quality}` 
    : src;

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      {/* Loading skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted/30 animate-skeleton-shimmer skeleton-gradient" />
      )}
      
      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 bg-muted/50 flex items-center justify-center">
          <span className="text-muted-foreground text-xs">✕</span>
        </div>
      )}
      
      {/* Actual image */}
      <img
        src={optimizedSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        width={width}
        height={height}
        onLoad={handleLoad}
        onError={handleError}
        className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        style={{
          // Request smaller image size based on container
          maxWidth: width ? `${width}px` : undefined,
        }}
      />
    </div>
  );
});

ImageWithLoader.displayName = 'ImageWithLoader';

export default ImageWithLoader;
