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
      <div className="w-full aspect-[21/9] md:aspect-[3/1] bg-muted/50 animate-pulse rounded-2xl mx-4 md:mx-8 my-4" />
    );
  }

  if (!banners || banners.length === 0) {
    return null;
  }

  const currentBanner = banners[currentIndex];

  const renderActionButton = (banner: Banner) => {
    const buttonText = banner.button_text_ar || banner.button_text || 'عرض';
    
    const buttonBaseClass = "inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5";
    
    switch (banner.action_type) {
      case 'product':
        if (!banner.product_id) return null;
        return (
          <Link
            to={`/product/${banner.product_id}`}
            className={cn(buttonBaseClass, "bg-primary text-primary-foreground hover:bg-primary/90")}
          >
            {buttonText}
            <ExternalLink className="w-4 h-4" />
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
            <ExternalLink className="w-4 h-4" />
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
            <ExternalLink className="w-4 h-4" />
          </a>
        );
      
      case 'coupon':
        if (!banner.coupon_code) return null;
        return (
          <button
            onClick={() => handleCopyCoupon(banner.coupon_code!)}
            className={cn(buttonBaseClass, "bg-accent text-accent-foreground hover:bg-accent/90")}
          >
            {copiedCoupon === banner.coupon_code ? (
              <>
                <Check className="w-4 h-4" />
                تم النسخ!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
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
    <div className="px-4 md:px-8 py-4">
      <div 
        className="relative w-full overflow-hidden rounded-2xl bg-card/50 border border-border/30 shadow-xl"
        onMouseEnter={() => setIsAutoPlaying(false)}
        onMouseLeave={() => setIsAutoPlaying(true)}
      >
        {/* Banner Container */}
        <div className="relative aspect-[21/9] md:aspect-[3/1] overflow-hidden">
          {banners.map((banner, index) => (
            <div
              key={banner.id}
              className={cn(
                "absolute inset-0 transition-all duration-700 ease-in-out",
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
              
              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              
              {/* Content */}
              <div className="absolute bottom-0 right-0 left-0 p-6 md:p-8 flex items-end justify-between">
                <div className="flex flex-col gap-3">
                  {banner.title_ar && (
                    <h3 className="text-white font-bold text-xl md:text-2xl lg:text-3xl drop-shadow-lg max-w-2xl">
                      {banner.title_ar}
                    </h3>
                  )}
                  {renderActionButton(banner)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Arrows */}
        {banners.length > 1 && (
          <>
            <button
              onClick={goToNext}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-all hover:scale-110"
              aria-label="السابق"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={goToPrevious}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-all hover:scale-110"
              aria-label="التالي"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Dots Indicator */}
        {banners.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  setIsAutoPlaying(false);
                  setTimeout(() => setIsAutoPlaying(true), 10000);
                }}
                className={cn(
                  "h-2.5 rounded-full transition-all duration-300",
                  index === currentIndex 
                    ? "bg-white w-8" 
                    : "bg-white/40 hover:bg-white/60 w-2.5"
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
