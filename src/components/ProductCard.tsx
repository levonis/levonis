import { memo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Heart, CreditCard } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { resizeSupabaseImage, IMAGE_QUALITY, IMAGE_SIZES } from '@/lib/imageUtils';
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
  cardDiscounts?: Array<{ level_id: string; discount_amount: number }> | null;
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

  const localProduct = {
    name_ar: nameAr,
    name_en: nameEn,
    name_ku: nameKu,
    description_ar: descriptionAr,
    description_en: descriptionEn,
    description_ku: descriptionKu,
  };
  const displayName = getLocalizedField(localProduct, 'name', language);
  const displayDescription = getLocalizedField(localProduct, 'description', language);

  const displayImage = (images && images.length > 0) ? images[0] : imageUrl;
  const optimizedImage = resizeSupabaseImage(displayImage, IMAGE_SIZES.card, IMAGE_QUALITY.medium);

  // Status line shown beneath the title
  const statusLabel = !inStock
    ? t('product_out_of_stock')
    : hasDirectSale
      ? t('product_direct_sale_label') ?? 'بيع مباشر'
      : displayDescription || null;

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
      className="group block product-card-glass relative"
    >
      {/* Direct sale ribbon */}
      {hasDirectSale && <DirectSaleRibbon />}

      {/* Sale badge — glass pill */}
      {hasSale && !hasDirectSale && (
        <Badge
          variant="secondary"
          className="absolute top-2 left-2 z-30 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/15 bg-white/10 text-foreground backdrop-blur-md shadow-sm"
        >
          {t('product_discount_badge')}
        </Badge>
      )}

      {/* Out of stock badge */}
      {!inStock && (
        <Badge
          className="absolute top-2 right-2 z-30 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-destructive/30 bg-destructive/15 text-destructive backdrop-blur-md"
        >
          {t('product_out_of_stock')}
        </Badge>
      )}

      {/* Floating image — sits above the card top edge */}
      <div className="relative px-3 pt-3">
        <div className="relative aspect-square -mt-6 mb-2">
          {/* Soft cast shadow under the floating image */}
          <div className="floating-img-shadow" aria-hidden />

          <div className="relative h-full w-full overflow-hidden rounded-2xl bg-white/[0.03]">
            {!imageLoaded && (
              <div className="absolute inset-0 bg-muted/30 animate-skeleton-shimmer skeleton-gradient" />
            )}
            <img
              src={optimizedImage || '/placeholder.svg'}
              alt={nameAr}
              className={`w-full h-full object-cover transition-all duration-300 ease-out group-hover:scale-[1.04] ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
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
            {/* subtle inner highlight on the image */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_hsl(0_0%_100%/0.10),inset_0_-12px_24px_-12px_hsl(0_0%_0%/0.35)]" />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 pb-3 pt-1">
        <h3 className="engraved-text font-semibold text-[13px] leading-tight mb-0.5 line-clamp-1 group-hover:text-primary transition-colors">
          {displayName}
        </h3>

        {statusLabel && (
          <p className="text-[10.5px] text-muted-foreground/85 mb-2 line-clamp-1">
            {statusLabel}
          </p>
        )}

        {soldCount > 0 && (
          <div className="mb-1.5">
            <span className="text-[9.5px] text-muted-foreground/70">
              {t('product_units_sold', { count: soldCount })}
            </span>
          </div>
        )}

        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-1">
              {cardDiscountInfo && cardPrice != null && cardPrice > 0 ? (
                <>
                  <span className="engraved-text text-[15px] font-bold text-primary whitespace-nowrap leading-none">
                    {formatPrice(cardPrice)}
                  </span>
                  <span className="text-[9.5px] text-muted-foreground">
                    {resolvedCurrency}
                  </span>
                </>
              ) : (
                <>
                  <span className="engraved-text text-[15px] font-bold text-primary whitespace-nowrap leading-none">
                    {formatPrice(price)}
                  </span>
                  <span className="text-[9.5px] text-muted-foreground">
                    {resolvedCurrency}
                  </span>
                </>
              )}
            </div>

            {cardDiscountInfo && cardPrice != null && cardPrice > 0 && (
              <div className="flex items-center gap-1 flex-wrap mt-0.5">
                <span className="text-[10px] line-through text-muted-foreground/55 whitespace-nowrap">
                  {formatPrice(price)}
                </span>
                <span
                  className="inline-flex items-center gap-0.5 text-[8.5px] px-1.5 py-0 rounded-full whitespace-nowrap font-bold text-primary-foreground animate-card-discount-shine"
                  style={{
                    background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary-glow)), hsl(var(--primary)))`,
                    backgroundSize: '200% 100%',
                  }}
                >
                  <CreditCard className="h-2 w-2" />
                  {cardDiscountInfo.levelName}
                </span>
              </div>
            )}

            {hasSale && !cardDiscountInfo && (
              <div className="flex items-center gap-1 flex-wrap mt-0.5">
                <span className="text-[10px] line-through text-muted-foreground/55 whitespace-nowrap">
                  {formatPrice(originalPrice || 0)}
                </span>
                <span className="text-[9.5px] bg-primary/15 text-primary px-1.5 py-0 rounded-full whitespace-nowrap border border-primary/20">
                  -{formatPrice(savings)}
                </span>
              </div>
            )}
          </div>

          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 rounded-full border border-white/10 bg-white/[0.06] text-foreground backdrop-blur-md hover:bg-white/[0.14] hover:text-primary transition-all shadow-[inset_0_1px_0_hsl(0_0%_100%/0.10)]"
            onClick={handleAddToFavorites}
            disabled={isAdding}
            aria-label={t('product_add_to_favorites')}
          >
            <Heart className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Link>
  );
};

export default memo(ProductCard);
