import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, Copy, Check, ExternalLink } from 'lucide-react';
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

const BannerCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

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
    staleTime: 60000,
    gcTime: 300000,
  });

  // Auto-play functionality
  useEffect(() => {
    if (!banners || banners.length <= 1 || !isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [banners, isAutoPlaying]);

  const goToPrevious = useCallback(() => {
    if (!banners) return;
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  }, [banners]);

  const goToNext = useCallback(() => {
    if (!banners) return;
    setCurrentIndex((prev) => (prev + 1) % banners.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  }, [banners]);

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

  const getCropStyle = (banner: Banner) => {
    if (!banner.crop_settings || typeof banner.crop_settings !== 'object') {
      return { objectFit: 'cover' as const, objectPosition: 'center' };
    }
    const settings = banner.crop_settings as unknown as CropSettings;
    if (!settings.x || !settings.y || !settings.width || !settings.height) {
      return { objectFit: 'cover' as const, objectPosition: 'center' };
    }
    return {
      objectFit: 'none' as const,
      objectPosition: `${-settings.x}px ${-settings.y}px`,
      width: `${settings.width}px`,
      height: `${settings.height}px`,
    };
  };

  if (isLoading) {
    return (
      <div className="w-full aspect-[21/9] md:aspect-[3/1] bg-muted/50 animate-pulse rounded-xl mx-3 md:mx-6" />
    );
  }

  if (!banners || banners.length === 0) {
    return null;
  }

  const currentBanner = banners[currentIndex];

  const renderActionButton = (banner: Banner) => {
    const buttonText = banner.button_text_ar || banner.button_text || 'عرض';
    
    const buttonBaseClass = "inline-flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-medium text-xs md:text-sm transition-all duration-300 shadow-md hover:shadow-lg";
    
    switch (banner.action_type) {
      case 'product':
        if (!banner.product_id) return null;
        return (
          <Link
            to={`/product/${banner.product_id}`}
            className={cn(buttonBaseClass, "bg-primary text-primary-foreground hover:bg-primary/90")}
          >
            {buttonText}
            <ExternalLink className="w-3 h-3 md:w-3.5 md:h-3.5" />
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
            className={cn(buttonBaseClass, "bg-primary text-primary-foreground hover:bg-primary/90")}
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
            className={cn(buttonBaseClass, "bg-white/90 text-gray-800 hover:bg-white")}
          >
            {copiedCoupon === banner.coupon_code ? (
              <>
                <Check className="w-3 h-3 md:w-3.5 md:h-3.5" />
                تم النسخ!
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 md:w-3.5 md:h-3.5" />
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
    <div className="px-1 md:px-2">
      <div 
        className="relative w-full overflow-hidden rounded-lg md:rounded-xl bg-card/50 border border-border/20 shadow-lg"
        onMouseEnter={() => setIsAutoPlaying(false)}
        onMouseLeave={() => setIsAutoPlaying(true)}
      >
        {/* Banner Container */}
        <div className="relative aspect-[2/1] md:aspect-[3/1] overflow-hidden">
          {banners.map((banner, index) => (
            <div
              key={banner.id}
              className={cn(
                "absolute inset-0 transition-all duration-500 ease-out",
                index === currentIndex 
                  ? "opacity-100 translate-x-0" 
                  : index < currentIndex 
                    ? "opacity-0 -translate-x-full" 
                    : "opacity-0 translate-x-full"
              )}
            >
              <img
                src={banner.image_url}
                alt={banner.title_ar || banner.title}
                className="w-full h-full object-cover"
                loading={index === 0 ? 'eager' : 'lazy'}
              />
              
              {/* Overlay Gradient - lighter */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              
              {/* Content - smaller and positioned better */}
              <div className="absolute bottom-0 right-0 left-0 p-3 md:p-5 flex items-end justify-between">
                <div className="flex flex-col gap-2">
                  {banner.title_ar && (
                    <h3 className="text-white font-bold text-sm md:text-lg lg:text-xl drop-shadow-md max-w-xl line-clamp-2">
                      {banner.title_ar}
                    </h3>
                  )}
                  {renderActionButton(banner)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Arrows - smaller */}
        {banners.length > 1 && (
          <>
            <button
              onClick={goToNext}
              className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-all"
              aria-label="السابق"
            >
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button
              onClick={goToPrevious}
              className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-all"
              aria-label="التالي"
            >
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </>
        )}

        {/* Dots Indicator - smaller */}
        {banners.length > 1 && (
          <div className="absolute bottom-2 md:bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  setIsAutoPlaying(false);
                  setTimeout(() => setIsAutoPlaying(true), 10000);
                }}
                className={cn(
                  "h-1.5 md:h-2 rounded-full transition-all duration-300",
                  index === currentIndex 
                    ? "bg-white w-5 md:w-6" 
                    : "bg-white/40 hover:bg-white/60 w-1.5 md:w-2"
                )}
                aria-label={`الانتقال إلى البانر ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BannerCarousel;
