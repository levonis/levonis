import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Json } from '@/integrations/supabase/types';
import { useLanguage } from '@/lib/i18n';
import { pickI18n } from '@/lib/i18nField';
import { resizeSupabaseImage } from '@/lib/imageUtils';

interface CropSettings {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Banner {
  id: string;
  title: string;
  title_ar: string;
  image_url: string;
  action_type: string;
  product_id: string | null;
  page_url: string | null;
  external_url: string | null;
  coupon_code: string | null;
  button_text: string | null;
  button_text_ar: string | null;
  display_order: number;
  crop_settings: Json | null;
}

// LCP-optimized image component with proper loading attributes
const BannerImage = memo(({ 
  src, 
  alt, 
  isFirst, 
  isActive 
}: { 
  src: string; 
  alt: string; 
  isFirst: boolean; 
  isActive: boolean;
}) => {
  const [loaded, setLoaded] = useState(false);

  // Right-size + serve next-gen formats. Mobile (LCP critical path) only needs ~800px.
  // AVIF saves ~30-50% over WebP at the same visual quality; WebP stays as fallback
  // for the ~5% of browsers without AVIF support.
  const width = isFirst ? 800 : 900;
  const quality = isFirst ? 62 : 68; // a touch lower on the LCP image for faster paint
  const avifSrc = useMemo(
    () => resizeSupabaseImage(src, width, quality, 'avif') || src,
    [src, width, quality]
  );
  const webpSrc = useMemo(
    () => resizeSupabaseImage(src, width, quality, 'webp') || src,
    [src, width, quality]
  );

  // NOTE: LCP preload is emitted from index.html's inline banner-fetch script
  // (matches format=avif, quality=62, width=800 exactly). We no longer emit a
  // runtime <link rel=preload> here — doing both caused a triple-download.


  return (
    <picture>
      <source srcSet={avifSrc} type="image/avif" />
      <source srcSet={webpSrc} type="image/webp" />
      <img
        src={webpSrc}
        alt={alt}
        className={cn(
          "w-full h-full object-cover object-center",
          // Skip opacity transition for the LCP image so paint isn't delayed
          isFirst ? "" : "transition-opacity duration-300",
          isFirst || loaded ? "opacity-100" : "opacity-0"
        )}
        loading={isFirst ? 'eager' : 'lazy'}
        decoding={isFirst ? 'sync' : 'async'}
        // @ts-expect-error - fetchPriority is valid HTML but not yet in React types in some versions
        fetchpriority={isFirst ? 'high' : 'auto'}
        onLoad={() => setLoaded(true)}
        // Intrinsic size hints to prevent layout shift
        width={1200}
        height={400}
      />
    </picture>
  );
});
BannerImage.displayName = 'BannerImage';

const BannerCarousel = memo(() => {
  const { language } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isFlashing, setIsFlashing] = useState(false);
  const progressKey = useRef(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const localizedTitle = useCallback((b: Banner) => pickI18n(b as any, 'title', language), [language]);
  const localizedButton = useCallback((b: Banner) => pickI18n(b as any, 'button_text', language), [language]);

  const { data: banners, isLoading } = useQuery({
    queryKey: ['active-banners'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as Banner[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes - match other queries
  });

  // Auto-play is driven entirely by the golden border animation's onAnimationEnd
  // (see SVG below). This guarantees the counter and slide transition are perfectly
  // in sync, and pausing the animation also pauses the slide change.

  // Touch handlers for swipe + pause-while-touching
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsAutoPlaying(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (banners && touchStartX.current !== null && touchEndX.current !== null) {
      const diff = touchStartX.current - touchEndX.current;
      const threshold = 50;

      if (Math.abs(diff) > threshold) {
        if (diff > 0) {
          setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
        } else {
          setCurrentIndex((prev) => (prev + 1) % banners.length);
        }
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
    // Resume after a short delay so user can read the highlighted title
    setTimeout(() => setIsAutoPlaying(true), 2500);
  };

  const handleCopyCoupon = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCoupon(code);
      toast.success('تم نسخ الكوبون!');
      setTimeout(() => setCopiedCoupon(null), 2000);
    } catch {
      toast.error('فشل نسخ الكوبون');
    }
  };

  // Active banner (safe before early returns: may be undefined)
  const currentBanner = banners?.[currentIndex];

  // Memoized palette — only recomputes when the active banner changes
  const borderGradient = useMemo(() => {
    if (!currentBanner) {
      return { from: '#FFD700', mid: '#FFA500', to: '#FFD700', glow: 'rgba(255,180,0,0.65)' };
    }
    const palettes: Record<string, { from: string; mid: string; to: string; glow: string }> = {
      product:  { from: '#FFD700', mid: '#FFA500', to: '#FFD700', glow: 'rgba(255,180,0,0.65)' },
      page:     { from: '#7DD3FC', mid: '#3B82F6', to: '#7DD3FC', glow: 'rgba(59,130,246,0.65)' },
      external: { from: '#A78BFA', mid: '#7C3AED', to: '#A78BFA', glow: 'rgba(124,58,237,0.65)' },
      coupon:   { from: '#FCA5A5', mid: '#EF4444', to: '#FCA5A5', glow: 'rgba(239,68,68,0.65)' },
    };
    if (palettes[currentBanner.action_type]) return palettes[currentBanner.action_type];

    const title = localizedTitle(currentBanner) || currentBanner.title || '';
    let hash = 0;
    for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
    const hue = hash % 360;
    return {
      from: `hsl(${hue}, 90%, 70%)`,
      mid:  `hsl(${(hue + 20) % 360}, 95%, 55%)`,
      to:   `hsl(${hue}, 90%, 70%)`,
      glow: `hsla(${(hue + 20) % 360}, 95%, 55%, 0.65)`,
    };
  }, [currentBanner?.id, currentBanner?.action_type, currentBanner, localizedTitle]);

  if (isLoading) {
    return (
      <div className="w-full aspect-[2.5/1] md:aspect-[3/1] bg-muted/50 animate-pulse rounded-lg" />
    );
  }

  if (!banners || banners.length === 0 || !currentBanner) {
    return null;
  }


  const renderActionButton = (banner: Banner) => {
    const fallbackBtn = language === 'en' ? 'View' : language === 'ku' ? 'بینین' : 'عرض';
    const buttonText = localizedButton(banner) || banner.button_text || fallbackBtn;
    
    // Glassmorphism — responsive sizing + high-contrast for readability
    const glassClass = cn(
      "inline-flex items-center gap-1.5 md:gap-2 rounded-full font-semibold transition-all duration-300",
      "px-3 py-1.5 text-[11px]",                       // mobile
      "md:px-4 md:py-2 md:text-sm md:gap-2",           // tablet
      "lg:px-5 lg:py-2.5 lg:text-base",                // desktop
      "bg-black/35 hover:bg-black/45 backdrop-blur-xl backdrop-saturate-150",
      "border border-white/40 ring-1 ring-inset ring-white/15",
      "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]",
      "shadow-[0_4px_16px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.2)]",
      "hover:shadow-[0_8px_24px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.3)]",
      "hover:-translate-y-0.5 active:translate-y-0"
    );
    
    switch (banner.action_type) {
      case 'product':
        if (!banner.product_id) return null;
        return (
          <Link to={`/product/${banner.product_id}`} className={glassClass}>
            {buttonText}
            <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-[18px] lg:h-[18px]" />
          </Link>
        );
      
      case 'page':
        if (!banner.page_url) return null;
        return (
          <Link to={banner.page_url} className={glassClass}>
            {buttonText}
            <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-[18px] lg:h-[18px]" />
          </Link>
        );
      
      case 'external':
        if (!banner.external_url) return null;
        return (
          <a
            href={banner.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className={glassClass}
          >
            {buttonText}
            <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-[18px] lg:h-[18px]" />
          </a>
        );
      
      case 'coupon':
        if (!banner.coupon_code) return null;
        return (
          <button
            onClick={() => handleCopyCoupon(banner.coupon_code!)}
            className={glassClass}
          >
            {copiedCoupon === banner.coupon_code ? (
              <>
                <Check className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-[18px] lg:h-[18px]" />
                {language === 'en' ? 'Copied!' : language === 'ku' ? 'کۆپی کرا!' : 'تم النسخ!'}
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-[18px] lg:h-[18px]" />
                <span className="font-mono tracking-wide">{banner.coupon_code}</span>
              </>
            )}
          </button>
        );
      
      default:
        return null;
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-lg bg-card/30 border border-border/10 shadow-md"
      style={{ touchAction: 'pan-y' }}
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Banner Container - Full width image */}
      <div className="relative aspect-[2.5/1] md:aspect-[3/1] overflow-hidden">
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={cn(
              "absolute inset-0 transition-opacity duration-500 ease-out",
              index === currentIndex 
                ? "opacity-100 z-10" 
                : "opacity-0 z-0"
            )}
            style={{ contain: 'layout paint' }}
          >
            <BannerImage
              src={banner.image_url}
              alt={localizedTitle(banner) || banner.title}
              isFirst={index === 0}
              isActive={index === currentIndex}
            />
            
            {/* Overlay Gradient - subtle */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            
            {/* Content - glassmorphism */}
            <div className="absolute bottom-0 right-0 left-0 p-3 md:p-5 flex items-end justify-between">
              <div className="flex flex-col gap-2">
                {(() => {
                  const t = localizedTitle(banner);
                  return t ? (
                    <div
                      className={cn(
                        "inline-flex w-fit rounded-full backdrop-blur-xl backdrop-saturate-150 transition-all duration-300 ease-out",
                        "bg-black/35 border border-white/40 ring-1 ring-inset ring-white/15",
                        "shadow-[0_4px_16px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.2)]",
                        !isAutoPlaying
                          ? "px-4 py-1.5 md:px-5 md:py-2 lg:px-6 lg:py-2.5 bg-black/50 border-white/60 scale-105 shadow-[0_8px_28px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.3)]"
                          : "px-3 py-1.5 md:px-4 md:py-2 lg:px-5 lg:py-2.5"
                      )}
                    >
                      <h3
                        className={cn(
                          "text-white font-bold max-w-md transition-all duration-300 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]",
                          !isAutoPlaying
                            ? "text-sm md:text-base lg:text-lg line-clamp-2"
                            : "text-xs md:text-sm lg:text-base line-clamp-1"
                        )}
                      >
                        {t}
                      </h3>
                    </div>
                  ) : null;
                })()}
                {renderActionButton(banner)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Single SVG: halo (color fade-in) + animated golden counter — fewer DOM nodes & defs */}
      {banners.length > 1 && (
        <svg
          className="pointer-events-none absolute inset-0 w-full h-full z-10"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <defs>
            {/* Stable IDs — gradient stops update via React props, no defs re-keying */}
            <linearGradient id="bannerBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={borderGradient.from} />
              <stop offset="50%" stopColor={borderGradient.mid} />
              <stop offset="100%" stopColor={borderGradient.to} />
            </linearGradient>
          </defs>

          {/* Halo: fades in on banner change */}
          <rect
            key={`halo-${currentIndex}`}
            x="0.4" y="0.4" width="99.2" height="99.2" rx="2.5" ry="2.5"
            fill="none"
            stroke="url(#bannerBorderGrad)"
            strokeWidth="0.8"
            strokeOpacity="0.4"
            vectorEffect="non-scaling-stroke"
            className="animate-banner-color-fade"
          />

          {/* Animated counter trace */}
          <rect
            key={`border-${currentIndex}`}
            x="0.4" y="0.4" width="99.2" height="99.2" rx="2.5" ry="2.5"
            fill="none"
            stroke="url(#bannerBorderGrad)"
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            // dasharray/dashoffset are driven by the keyframes (snake trace)
            className="animate-banner-border-progress"
            style={{
              filter: `drop-shadow(0 0 3px ${borderGradient.glow})`,
              animationPlayState: isAutoPlaying ? 'running' : 'paused',
            }}
            onAnimationEnd={() => {
              if (!isAutoPlaying) return;
              setIsFlashing(true);
              window.setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % banners.length);
                setIsFlashing(false);
              }, 900);
            }}
          />
        </svg>
      )}

      {/* Glassmorphism flash overlay — single, soft, slow */}
      {isFlashing && (
        <div
          key={`flash-${currentIndex}`}
          className="pointer-events-none absolute inset-0 z-30 rounded-lg overflow-hidden animate-banner-flash"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.10) 100%)',
            backdropFilter: 'blur(4px) saturate(120%)',
            WebkitBackdropFilter: 'blur(4px) saturate(120%)',
          }}
        />
      )}
    </div>
  );
});

BannerCarousel.displayName = 'BannerCarousel';

export default BannerCarousel;
