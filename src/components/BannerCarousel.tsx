import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Json } from '@/integrations/supabase/types';

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

  // Preload first image immediately via link tag
  useEffect(() => {
    if (isFirst && typeof window !== 'undefined') {
      const existingPreload = document.querySelector(`link[href="${src}"]`);
      if (!existingPreload) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = src;
        link.fetchPriority = 'high';
        document.head.appendChild(link);
      }
    }
  }, [src, isFirst]);

  return (
    <img
      src={src}
      alt={alt}
      className={cn(
        "w-full h-full object-cover object-center transition-opacity duration-300",
        loaded ? "opacity-100" : "opacity-0"
      )}
      loading={isFirst ? 'eager' : 'lazy'}
      decoding={isFirst ? 'sync' : 'async'}
      onLoad={() => setLoaded(true)}
      // Add intrinsic size hints to prevent layout shift
      width={1200}
      height={400}
    />
  );
});
BannerImage.displayName = 'BannerImage';

const BannerCarousel = memo(() => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const progressKey = useRef(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Auto-play - single timeout for slide transition (progress bar is CSS-only)
  useEffect(() => {
    if (!banners || banners.length <= 1 || !isAutoPlaying) return;

    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearTimeout(timer);
  }, [banners, isAutoPlaying, currentIndex]);

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current || !banners) return;
    
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        // Swipe left - next (RTL: previous)
        setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
      } else {
        // Swipe right - previous (RTL: next)
        setCurrentIndex((prev) => (prev + 1) % banners.length);
      }
      setIsAutoPlaying(false);
      setTimeout(() => setIsAutoPlaying(true), 10000);
    }

    touchStartX.current = null;
    touchEndX.current = null;
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

  if (isLoading) {
    return (
      <div className="w-full aspect-[2.5/1] md:aspect-[3/1] bg-muted/50 animate-pulse rounded-lg" />
    );
  }

  if (!banners || banners.length === 0) {
    return null;
  }

  const currentBanner = banners[currentIndex];

  const renderActionButton = (banner: Banner) => {
    const buttonText = banner.button_text_ar || banner.button_text || 'عرض';
    
    // Glassmorphism light style
    const glassClass = "inline-flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-full font-medium text-[11px] md:text-xs transition-all duration-300 bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/30 text-white shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.25)]";
    
    switch (banner.action_type) {
      case 'product':
        if (!banner.product_id) return null;
        return (
          <Link to={`/product/${banner.product_id}`} className={glassClass}>
            {buttonText}
            <ExternalLink className="w-3 h-3 md:w-3.5 md:h-3.5" />
          </Link>
        );
      
      case 'page':
        if (!banner.page_url) return null;
        return (
          <Link to={banner.page_url} className={glassClass}>
            {buttonText}
            <ExternalLink className="w-3 h-3 md:w-3.5 md:h-3.5" />
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
            <ExternalLink className="w-3 h-3 md:w-3.5 md:h-3.5" />
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
                <Check className="w-3 h-3 md:w-3.5 md:h-3.5" />
                تم النسخ!
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 md:w-3.5 md:h-3.5" />
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
              alt={banner.title_ar || banner.title}
              isFirst={index === 0}
              isActive={index === currentIndex}
            />
            
            {/* Overlay Gradient - subtle */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            
            {/* Content - glassmorphism */}
            <div className="absolute bottom-0 right-0 left-0 p-3 md:p-5 flex items-end justify-between">
              <div className="flex flex-col gap-2">
                {banner.title_ar && (
                  <div className="inline-flex w-fit px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
                    <h3 className="text-white font-bold text-xs md:text-sm lg:text-base drop-shadow-sm max-w-md line-clamp-1">
                      {banner.title_ar}
                    </h3>
                  </div>
                )}
                {renderActionButton(banner)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Golden border progress counter - SVG that traces the rounded rectangle border */}
      {banners.length > 1 && (
        <svg
          key={`border-${currentIndex}-${isAutoPlaying}`}
          className="pointer-events-none absolute inset-0 w-full h-full z-20"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFD700" />
              <stop offset="50%" stopColor="#FFA500" />
              <stop offset="100%" stopColor="#FFD700" />
            </linearGradient>
          </defs>
          <rect
            x="0.4"
            y="0.4"
            width="99.2"
            height="99.2"
            rx="2.5"
            ry="2.5"
            fill="none"
            stroke="url(#goldGradient)"
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1}
            className={isAutoPlaying ? "animate-banner-border-progress" : ""}
            style={{
              filter: "drop-shadow(0 0 3px rgba(255, 215, 0, 0.6))",
            }}
          />
        </svg>
      )}
    </div>
  );
});

BannerCarousel.displayName = 'BannerCarousel';

export default BannerCarousel;
