import { memo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Heart } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { resizeSupabaseImage, IMAGE_QUALITY, IMAGE_SIZES } from '@/lib/imageUtils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import DirectSaleRibbon from './ui/DirectSaleRibbon';

interface ProductCardProps {
  id: string;
  name: string;
  nameAr: string;
  description?: string;
  descriptionAr?: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
  images?: string[];
  currency?: string;
  slug: string;
  priority?: boolean;
  hasDirectSale?: boolean;
  inStock?: boolean;
  soldCount?: number;
}

const ProductCard = ({ 
  id, 
  name, 
  nameAr, 
  description, 
  descriptionAr, 
  price, 
  originalPrice, 
  imageUrl,
  images,
  currency = 'دينار عراقي',
  slug,
  priority = false,
  inStock = true,
  hasDirectSale = false,
  soldCount = 0
}: ProductCardProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const hasSale = originalPrice && originalPrice > price;
  const savings = hasSale ? originalPrice - price : 0;
  
  const displayImage = (images && images.length > 0) ? images[0] : imageUrl;
  // Compress image to 300px width with medium quality for cards
  const optimizedImage = resizeSupabaseImage(displayImage, IMAGE_SIZES.card, IMAGE_QUALITY.medium);

  const handleAddToFavorites = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('يرجى تسجيل الدخول أولاً');
        return;
      }

      // Check if already in favorites
      const { data: existing } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', id)
        .maybeSingle();

      if (existing) {
        toast.info('المنتج موجود بالفعل في المفضلة');
        return;
      }

      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, product_id: id });

      if (error) throw error;
      toast.success('تمت الإضافة إلى المفضلة');
    } catch (error) {
      console.error('Error adding to favorites:', error);
      toast.error('حدث خطأ أثناء الإضافة للمفضلة');
    } finally {
      setIsAdding(false);
    }
  }, [id]);

  return (
    <Link 
      to={`/product/${slug}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="group block bg-gradient-to-b from-card to-card/80 rounded-lg p-1.5 border border-border/30 hover:border-primary/40 transition-all hover:-translate-y-0.5 relative overflow-hidden"
    >
      {/* Direct sale ribbon */}
      {hasDirectSale && <DirectSaleRibbon />}

      {/* Sale badge - above image */}
      {hasSale && !hasDirectSale && (
        <Badge 
          variant="secondary" 
          className="absolute top-0.5 left-0.5 z-20 text-[10px] bg-primary/90 text-primary-foreground border-0 shadow-sm px-1.5 py-0"
        >
          تخفيض
        </Badge>
      )}
      
      {/* Out of stock badge */}
      {!inStock && (
        <Badge 
          variant="destructive" 
          className="absolute top-0.5 right-0.5 z-20 text-[10px] border-0 shadow-sm px-1.5 py-0"
        >
          غير متوفر
        </Badge>
      )}

      <div className="relative mb-1.5">
        <div className="relative overflow-hidden rounded-md aspect-square bg-muted/20">
          {/* Loading skeleton */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-muted/30 animate-skeleton-shimmer skeleton-gradient" />
          )}
          <img 
            src={optimizedImage || '/placeholder.svg'} 
            alt={nameAr}
            className={`w-full h-full object-cover group-hover:scale-103 transition-all duration-200 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            width="300"
            height="300"
            onLoad={() => setImageLoaded(true)}
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              target.src = '/placeholder.svg';
              setImageLoaded(true);
            }}
          />
        </div>
      </div>
      
      <h3 className="font-semibold text-xs leading-tight mb-0.5 text-foreground group-hover:text-primary transition-colors line-clamp-1">
        {nameAr}
      </h3>
      
      {descriptionAr && (
        <p className="text-[10px] text-muted-foreground mb-1 line-clamp-1">
          {descriptionAr}
        </p>
      )}

      {soldCount > 0 && (
        <div className="flex items-center gap-0.5 mb-1">
          <span className="text-[9px] text-muted-foreground/70">
            🔥 {soldCount} قطعة مباعة
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-1">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-0.5">
            <span className="text-sm font-bold text-primary whitespace-nowrap">
              {formatPrice(price)}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {currency}
            </span>
          </div>
          {hasSale && (
            <div className="flex items-center gap-0.5 flex-wrap">
              <span className="text-[10px] line-through text-muted-foreground/60 whitespace-nowrap">
                {formatPrice(originalPrice || 0)}
              </span>
              <span className="text-[9px] bg-primary/10 text-primary px-1 py-0 rounded-full whitespace-nowrap">
                -{formatPrice(savings)}
              </span>
            </div>
          )}
        </div>
        
        <Button 
          size="sm"
          className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90 h-6 w-6 p-0 flex-shrink-0 rounded-md"
          onClick={handleAddToFavorites}
          disabled={isAdding}
          aria-label="أضف للمفضلة"
        >
          <Heart className="h-3 w-3" />
        </Button>
      </div>
    </Link>
  );
};

export default memo(ProductCard);