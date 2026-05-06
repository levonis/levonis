import { memo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Heart, CreditCard } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { resizeSupabaseImage, buildResponsiveSrcSet, IMAGE_QUALITY, IMAGE_SIZES } from '@/lib/imageUtils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import DirectSaleRibbon from './ui/DirectSaleRibbon';
import { useProductCardDiscount } from '@/hooks/useProductCardDiscount';
import { getLocalizedField } from '@/hooks/useLocalizedProduct';
import { useLanguage } from '@/lib/i18n';

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
  cardDiscounts?: Array<{ card_id: string; discount_amount: number }> | null;
  nameEn?: string | null;
  nameKu?: string | null;
  descriptionEn?: string | null;
  descriptionKu?: string | null;
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
  currency,
  slug,
  priority = false,
  inStock = true,
  hasDirectSale = false,
  soldCount = 0,
  cardDiscounts = null,
  nameEn = null,
  nameKu = null,
  descriptionEn = null,
  descriptionKu = null,
}: ProductCardProps) => {
  const { language, t } = useLanguage();
  const resolvedCurrency = currency ?? t('product_default_currency');
  const [isAdding, setIsAdding] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const { getDiscount } = useProductCardDiscount();
  const cardDiscountInfo = getDiscount(cardDiscounts);
  const hasSale = originalPrice && originalPrice > price;
  const savings = hasSale ? originalPrice - price : 0;
  const cardPrice = cardDiscountInfo ? price - cardDiscountInfo.discountAmount : null;
  
  const localProduct = { name_ar: nameAr, name_en: nameEn, name_ku: nameKu, description_ar: descriptionAr, description_en: descriptionEn, description_ku: descriptionKu };
  const displayName = getLocalizedField(localProduct, 'name', language);
  const displayDescription = getLocalizedField(localProduct, 'description', language);
  
  const displayImage = (images && images.length > 0) ? images[0] : imageUrl;
  const optimizedImage = resizeSupabaseImage(displayImage, IMAGE_SIZES.card, IMAGE_QUALITY.medium);
  const srcSet = buildResponsiveSrcSet(displayImage, [200, 300, 400, 600], IMAGE_QUALITY.medium);

  const handleAddToFavorites = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t('product_login_required'));
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
        toast.info(t('product_already_in_favorites'));
        return;
      }

      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, product_id: id });

      if (error) throw error;
      toast.success(t('product_added_to_favorites'));
    } catch (error) {
      console.error('Error adding to favorites:', error);
      toast.error(t('product_favorite_error'));
    } finally {
      setIsAdding(false);
    }
  }, [id, t]);

  return (
    <Link 
      to={`/product/${slug}`}
      className="group block product-card-glass p-1.5 relative"
    >
      {/* Direct sale ribbon */}
      {hasDirectSale && <DirectSaleRibbon />}

      {/* Sale badge - above image */}
      {hasSale && !hasDirectSale && (
        <Badge 
          variant="secondary" 
          className="absolute top-0.5 left-0.5 z-20 text-[10px] bg-primary/90 text-primary-foreground border-0 shadow-sm px-1.5 py-0"
        >
          {t('product_discount_badge')}
        </Badge>
      )}
      
      {/* Out of stock badge */}
      {!inStock && (
        <Badge 
          variant="destructive" 
          className="absolute top-0.5 right-0.5 z-20 text-[10px] border-0 shadow-sm px-1.5 py-0"
        >
          {t('product_out_of_stock')}
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
            {...({ fetchpriority: priority ? "high" : "auto" } as any)}
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
        {displayName}
      </h3>
      
      {displayDescription && (
        <p className="text-[10px] text-muted-foreground mb-1 line-clamp-1">
          {displayDescription}
        </p>
      )}

      {soldCount > 0 && (
        <div className="flex items-center gap-0.5 mb-1">
          <span className="text-[9px] text-muted-foreground/70">
            {t('product_units_sold', { count: soldCount })}
          </span>
        </div>
      )}
      {hasSale && (
        <div className="mb-1 flex justify-start">
          <span className="relative inline-flex items-center rounded-md bg-gradient-to-b from-primary to-accent px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow-sm animate-fade-in">
            {t('product_discount_badge')}
            <span aria-hidden className="absolute -bottom-1 right-3 h-2 w-2 rotate-45 bg-accent" />
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-1">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-0.5">
            {cardDiscountInfo && cardPrice != null && cardPrice > 0 ? (
              <>
                <span className="text-sm font-bold text-primary whitespace-nowrap">
                  {formatPrice(cardPrice)}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {resolvedCurrency}
                </span>
              </>
            ) : (
              <>
                <span className="text-sm font-bold text-primary whitespace-nowrap">
                  {formatPrice(price)}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {resolvedCurrency}
                </span>
              </>
            )}
          </div>
          {cardDiscountInfo && cardPrice != null && cardPrice > 0 && (
            <div className="flex items-center gap-0.5 flex-wrap">
              <span className="text-[10px] line-through text-muted-foreground/60 whitespace-nowrap">
                {formatPrice(price)}
              </span>
              <span className="inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0 rounded-full whitespace-nowrap font-bold text-primary-foreground animate-card-discount-shine"
                style={{
                  background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary-glow)), hsl(var(--primary)))`,
                  backgroundSize: '200% 100%',
                }}>
                <CreditCard className="h-2 w-2" />
                {cardDiscountInfo.levelName}
              </span>
            </div>
          )}
          {hasSale && !cardDiscountInfo && (
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
          aria-label={t('product_add_to_favorites')}
        >
          <Heart className="h-3 w-3" />
        </Button>
      </div>
    </Link>
  );
};

export default memo(ProductCard);