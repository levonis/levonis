import { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
 * ImageWithLoader — LQIP blur-up without flicker.
 * - Detects cached images on mount (skips fade-in entirely → no flash).
 * - LQIP stays underneath; main image just fades in on top (no crossfade gap).
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
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [instant, setInstant] = useState(false);

  const handleLoad = useCallback(() => setIsLoaded(true), []);
  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoaded(true);
  }, []);

  // Detect images already in the browser cache to avoid a load-flash.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setInstant(true);
      setIsLoaded(true);
    }
  }, [src]);

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

  const lqipSrc = useMemo(() => {
    const r = resizeSupabaseImage(src, 24, 20);
    return r && r !== src ? r : null;
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      {/* LQIP stays underneath — never fades out, so no gap between layers */}
      {lqipSrc && !hasError && !instant && (
        <img
          src={lqipSrc}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover lqip-blur opacity-100"
        />
      )}

      {!lqipSrc && !isLoaded && (
        <div className="absolute inset-0 bg-muted/20" />
      )}

      {hasError && (
        <div className="absolute inset-0 bg-muted/50 flex items-center justify-center">
          <span className="text-muted-foreground text-xs">✕</span>
        </div>
      )}

      <img
        ref={imgRef}
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
        className={`relative w-full h-full object-cover ${
          instant ? '' : 'transition-opacity duration-300 ease-out'
        } ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        style={{ maxWidth: width ? `${width}px` : undefined }}
      />
    </div>
  );
});

ImageWithLoader.displayName = 'ImageWithLoader';

export default ImageWithLoader;
