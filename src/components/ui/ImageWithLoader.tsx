import { memo, useState, useCallback, useMemo } from 'react';
import { resizeSupabaseImage, buildResponsiveSrcSet } from '@/lib/imageUtils';

interface ImageWithLoaderProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  quality?: number;
  srcSetWidths?: number[];
  sizes?: string;
}

const SNAP_WIDTHS = [120, 200, 300, 400, 600, 800, 1000, 1200, 1600];
function snapWidth(w?: number) {
  if (!w) return 600;
  return SNAP_WIDTHS.find((s) => s >= w) ?? SNAP_WIDTHS[SNAP_WIDTHS.length - 1];
}

/**
 * ImageWithLoader — LQIP blur-up pattern.
 * Loads a tiny 24px blurred version first, then fades in the full image.
 */
const ImageWithLoader = memo(({
  src,
  alt,
  className = '',
  containerClassName = '',
  priority = false,
  width,
  height,
  quality = 75,
  srcSetWidths,
  sizes,
}: ImageWithLoaderProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => setIsLoaded(true), []);
  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoaded(true);
  }, []);

  const baseWidth = snapWidth(width);
  const widths = useMemo(() => {
    if (srcSetWidths && srcSetWidths.length) return srcSetWidths;
    return Array.from(new Set([Math.max(120, Math.round(baseWidth / 2)), baseWidth, baseWidth * 2]))
      .filter((w) => w <= 1920);
  }, [srcSetWidths, baseWidth]);

  const optimizedSrc = useMemo(
    () => resizeSupabaseImage(src, baseWidth, quality) ?? src,
    [src, baseWidth, quality]
  );
  const srcSet = useMemo(
    () => buildResponsiveSrcSet(src, widths, quality),
    [src, widths, quality]
  );

  // LQIP: tiny blurred preview (only works for Supabase storage URLs)
  const lqipSrc = useMemo(() => {
    const r = resizeSupabaseImage(src, 24, 20);
    return r && r !== src ? r : null;
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      {/* LQIP blurred preview layer */}
      {lqipSrc && !hasError && (
        <img
          src={lqipSrc}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={`absolute inset-0 w-full h-full object-cover lqip-blur ${
            isLoaded ? 'opacity-0' : 'opacity-100'
          }`}
        />
      )}

      {/* Fallback skeleton only when no LQIP available */}
      {!lqipSrc && !isLoaded && (
        <div className="absolute inset-0 bg-muted/30 animate-skeleton-shimmer skeleton-gradient" />
      )}

      {hasError && (
        <div className="absolute inset-0 bg-muted/50 flex items-center justify-center">
          <span className="text-muted-foreground text-xs">✕</span>
        </div>
      )}

      <img
        src={optimizedSrc}
        srcSet={srcSet}
        sizes={sizes ?? '(max-width: 640px) 50vw, 25vw'}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        {...({ fetchpriority: priority ? 'high' : 'auto' } as any)}
        width={width}
        height={height}
        onLoad={handleLoad}
        onError={handleError}
        className={`relative transition-opacity duration-500 ease-out ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        style={{ maxWidth: width ? `${width}px` : undefined }}
      />
    </div>
  );
});

ImageWithLoader.displayName = 'ImageWithLoader';

export default ImageWithLoader;
