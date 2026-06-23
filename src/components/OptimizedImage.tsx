import { useState, useRef, useEffect, useMemo, memo } from "react";
import { resizeSupabaseImage, buildResponsiveSrcSet } from "@/lib/imageUtils";

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  // New props for better sizing hints
  width?: number;
  height?: number;
  sizes?: string;
  /**
   * Pixel width to request from Supabase image transform.
   * Defaults to `width * 2` (retina) when `width` is set, else 600.
   * Pass a number explicitly to override (e.g. 400 for thumbnails).
   */
  targetWidth?: number;
  /** Image quality 1-100. Default 75. */
  quality?: number;
}

const OptimizedImage = memo(({ 
  src, 
  alt, 
  className = "", 
  priority = false,
  onLoad,
  onError,
  width,
  height,
  sizes = "(max-width: 768px) 100vw, 50vw",
  targetWidth,
  quality = 60,
}: OptimizedImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (priority || isInView) return;

    // Use larger rootMargin on mobile for earlier loading
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin: isMobile ? "200px" : "100px",
        threshold: 0.01,
      }
    );

    if (imgRef.current) {
      observerRef.current.observe(imgRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [priority, isInView]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // Compute optimized URL using Supabase image transform (snap to standard sizes for cache hits)
  const optimizedSrc = useMemo(() => {
    if (!src) return src;
    const desired = targetWidth ?? (width ? width * 2 : 600);
    const standardSizes = [100, 200, 300, 400, 600, 800, 1000, 1200, 1600, 2000];
    const snapped = standardSizes.find((s) => s >= desired) || standardSizes[standardSizes.length - 1];
    return resizeSupabaseImage(src, snapped, quality) || src;
  }, [src, targetWidth, width, quality]);

  const srcSet = useMemo(() => {
    // Narrow srcSet on small viewports — no point shipping a 1200px candidate
    // to a 360px phone. Phase 6: small screens get the smallest pair only.
    const widths = typeof window !== 'undefined' && window.innerWidth < 480
      ? [160, 320]
      : typeof window !== 'undefined' && window.innerWidth < 768
        ? [200, 400, 600]
        : [200, 400, 600, 800, 1200];
    return buildResponsiveSrcSet(src, widths, quality);
  }, [src, quality]);

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      {/* Placeholder skeleton - uses CSS aspect-ratio if dimensions provided */}
      {!isLoaded && !hasError && (
        <div 
          className="absolute inset-0 bg-muted animate-pulse"
          style={width && height ? { aspectRatio: `${width}/${height}` } : undefined}
        />
      )}
      
      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <span className="text-muted-foreground text-xs">فشل التحميل</span>
        </div>
      )}
      
      {/* Actual image - only load when in view */}
      {isInView && !hasError && (
        <img
          src={optimizedSrc}
          srcSet={srcSet}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          {...({ fetchpriority: priority ? "high" : "auto" } as any)}
          onLoad={handleLoad}
          onError={handleError}
          width={width}
          height={height}
          sizes={sizes}
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
});

OptimizedImage.displayName = "OptimizedImage";

export default OptimizedImage;
