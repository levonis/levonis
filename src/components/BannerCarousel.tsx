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
      fetchPriority={isFirst ? 'high' : 'auto'}
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
  const [progress, setProgress] = useState(0);
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

  // Auto-play with progress bar
  useEffect(() => {
    if (!banners || banners.length <= 1 || !isAutoPlaying) return;

    const duration = 5000;
    const interval = 50;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += interval;
      setProgress((elapsed / duration) * 100);
      
      if (elapsed >= duration) {
        setCurrentIndex((prev) => (prev + 1) % banners.length);
        elapsed = 0;
        setProgress(0);
      }
    }, interval);

    return () => clearInterval(timer);
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
      setProgress(0);
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
    
    const buttonBaseClass = "inline-flex items-center gap-1 px-2.5 py-1 md:px-3 md:py-1.5 rounded-md font-medium text-[10px] md:text-xs transition-all duration-300 shadow-sm hover:shadow-md";
    
    switch (banner.action_type) {
      case 'product':
        if (!banner.product_id) return null;
        return (
          <Link
            to={`/product/${banner.product_id}`}
            className={cn(buttonBaseClass, "bg-primary text-primary-foreground hover:bg-primary/90")}
          >
            {buttonText}
            <ExternalLink className="w-2.5 h-2.5 md:w-3 md:h-3" />
          </Link>
        );
      
      case 'page':
        if (!banner.page_url) return null;
        return (
          <Link
            to={banner.page_url}
            className={cn(buttonBaseClass, "bg-primary text-primary-foreground hover:bg-primary/90")}
          >
            {buttonText}
            <ExternalLink className="w-2.5 h-2.5 md:w-3 md:h-3" />
          </Link>
        );
      
      case 'external':
        if (!banner.external_url) return null;
        return (
          <a
            href={banner.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonBaseClass, "bg-primary text-primary-foreground hover:bg-primary/90")}
          >
            {buttonText}
            <ExternalLink className="w-2.5 h-2.5 md:w-3 md:h-3" />
          </a>
        );
      
      case 'coupon':
        if (!banner.coupon_code) return null;
        return (
          <button
            onClick={() => handleCopyCoupon(banner.coupon_code!)}
            className={cn(buttonBaseClass, "bg-white/95 text-gray-800 hover:bg-white border border-white/20")}
          >
            {copiedCoupon === banner.coupon_code ? (
              <>
                <Check className="w-2.5 h-2.5 md:w-3 md:h-3" />
                تم النسخ!
              </>
            ) : (
              <>
                <Copy className="w-2.5 h-2.5 md:w-3 md:h-3" />
                {banner.coupon_code}
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
            // Use CSS containment for better performance
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
            
            {/* Content - compact */}
            <div className="absolute bottom-0 right-0 left-0 p-2 md:p-4 flex items-end justify-between">
              <div className="flex flex-col gap-1.5">
                {banner.title_ar && (
                  <h3 className="text-white font-bold text-xs md:text-base lg:text-lg drop-shadow-lg max-w-md line-clamp-1">
                    {banner.title_ar}
                  </h3>
                )}
                {renderActionButton(banner)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress Bar Indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
          <div 
            className="h-full bg-white/80 transition-all duration-50 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Dots Indicator - minimal */}
      {banners.length > 1 && (
        <div className="absolute bottom-1.5 md:bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentIndex(index);
                setIsAutoPlaying(false);
                setProgress(0);
                setTimeout(() => setIsAutoPlaying(true), 10000);
              }}
              className={cn(
                "h-1 md:h-1.5 rounded-full transition-all duration-300",
                index === currentIndex 
                  ? "bg-white w-4 md:w-5" 
                  : "bg-white/40 hover:bg-white/60 w-1 md:w-1.5"
              )}
              aria-label={`الانتقال إلى البانر ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
});

BannerCarousel.displayName = 'BannerCarousel';

export default BannerCarousel;
