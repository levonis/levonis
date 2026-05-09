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
  quality?: number; // 1-100, default 75
  /** Custom widths for the responsive srcSet. Defaults to a sensible ladder around `width`. */
  srcSetWidths?: number[];
  /** Custom `sizes` attribute. Defaults to "(max-width: 640px) 50vw, 25vw" for cards. */
  sizes?: string;
}

const SNAP_WIDTHS = [120, 200, 300, 400, 600, 800, 1000, 1200, 1600];
function snapWidth(w?: number) {
  if (!w) return 600;
  return SNAP_WIDTHS.find((s) => s >= w) ?? SNAP_WIDTHS[SNAP_WIDTHS.length - 1];
}

/**
 * ImageWithLoader — auto-routes Supabase storage URLs through the WebP
 * render endpoint, builds a responsive srcSet, and shows a shimmer until
 * the image is decoded.
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

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      {!isLoaded && (
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
        className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        style={{ maxWidth: width ? `${width}px` : undefined }}
      />
    </div>
  );
});

ImageWithLoader.displayName = 'ImageWithLoader';

export default ImageWithLoader;
