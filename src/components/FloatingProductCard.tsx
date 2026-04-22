import { memo } from 'react';
import { Link } from 'react-router-dom';
import { getLocalizedField } from '@/hooks/useLocalizedProduct';
import { useLanguage } from '@/lib/i18n';
import DirectSaleRibbon from './ui/DirectSaleRibbon';

interface FloatingProductCardProps {
  id: string;
  name: string;
  nameAr: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
  currency?: string;
  slug: string;
  featured?: boolean;
  nameEn?: string | null;
  nameKu?: string | null;
  hasDirectSale?: boolean;
}

const FloatingProductCard = memo(({
  nameAr,
  price,
  originalPrice,
  imageUrl,
  currency = 'IQD',
  slug,
  featured = false,
  nameEn = null,
  nameKu = null,
  hasDirectSale = false,
}: FloatingProductCardProps) => {
  const { language } = useLanguage();
  const localProduct = { name_ar: nameAr, name_en: nameEn, name_ku: nameKu };
  const displayName = getLocalizedField(localProduct, 'name', language);
  const discount = originalPrice && originalPrice > price
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

  if (featured) {
    return (
      <Link to={`/product/${slug}`} className="block">
        <div className="flex flex-col items-center">
          {/* Product image */}
          <div className="relative h-28 w-28 sm:h-48 sm:w-48 md:h-80 md:w-80 z-20 mb-[-1rem] sm:mb-[-2.5rem]">
            <img
              src={imageUrl || '/placeholder.svg'}
               alt={displayName}
              loading="eager"
              className="w-full h-full object-contain relative z-10"
            />
            {/* Contact shadow — tight at product base */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-24 h-3 sm:w-36 sm:h-4 md:w-60 md:h-5 rounded-[50%] bg-black/50 blur-md" />
          </div>

          {/* Ambient glow — outer halo */}
          <div className="cube-ambient-glow" />

          {/* Glow ring on platform */}
          <div className="cube-glow-ring" />

          {/* Top highlight edge */}
          <div className="cube-top-highlight" />

          {/* 3D Block — top face */}
          <div className="cube-top-featured" />
          {/* 3D Block — mid section */}
          <div className="cube-mid-featured" />
          {/* 3D Block — front face with engraved price & discount */}
          <div className="cube-front-featured relative overflow-hidden">
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-0.5">
              <span className="text-base md:text-lg font-black tracking-wide"
                style={{
                  color: 'hsl(155 50% 35% / 0.55)',
                  textShadow: '0 1px 2px hsl(160 20% 5% / 0.9), 0 -1px 1px hsl(155 40% 30% / 0.25)',
                }}>
                {price.toLocaleString()} {currency === 'IQD' ? 'د.ع' : currency}
              </span>
              {discount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold tracking-wider"
                    style={{
                      color: 'hsl(155 50% 35% / 0.45)',
                      textShadow: '0 1px 2px hsl(160 20% 5% / 0.9), 0 -1px 1px hsl(155 40% 30% / 0.25)',
                    }}>
                    -{discount}%
                  </span>
                  {originalPrice && (
                    <span className="text-[10px] line-through"
                      style={{
                        color: 'hsl(155 50% 35% / 0.35)',
                      }}>
                      {originalPrice.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* 3D Block — bottom edge highlight */}
          <div className="cube-bottom-edge" />
          {/* Bottom reflection strip */}
          <div className="cube-bottom-reflection" />

          {/* Ground reflection (larger) */}
          <div className="w-36 h-5 sm:w-64 sm:h-6 md:w-[26rem] md:h-9 mx-auto rounded-[50%] blur-2xl" style={{ marginTop: '-2px', background: 'radial-gradient(ellipse, hsl(160 40% 18% / 0.45), transparent 60%)' }} />

        </div>
      </Link>
    );
  }

  // Standard product — image-fill card
  return (
    <Link to={`/product/${slug}`} className="block group h-full">
      <div className="relative h-full flex flex-col rounded-xl overflow-hidden border border-border/30 bg-card/80 backdrop-blur-md hover:border-primary/30 transition-all duration-300">
        {/* Product image — fills the card top, no padding */}
        <div className="relative aspect-square overflow-hidden flex-shrink-0">
          <img
            src={imageUrl || '/placeholder.svg'}
            alt={displayName}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
          {/* Discount badge */}
          {discount > 0 && (
            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-destructive/90 text-destructive-foreground text-[9px] font-bold">
              -{discount}%
            </span>
          )}
        </div>

        {/* Product info */}
        <div className="p-2.5 pt-2 text-center space-y-1 flex-1 flex flex-col justify-center">
          <h3 className="text-[11px] md:text-sm font-bold text-foreground/85 leading-tight line-clamp-2">
            {displayName}
          </h3>
          <div className="flex items-center justify-center gap-1">
            <span className="text-sm md:text-base font-black text-primary">
              {price.toLocaleString()}
            </span>
            <span className="text-[8px] text-primary/60">
              {currency === 'IQD' ? 'د.ع' : currency}
            </span>
          </div>
          {originalPrice && discount > 0 && (
            <span className="line-through text-[9px] text-muted-foreground/60 block leading-none">
              {originalPrice.toLocaleString()} {currency === 'IQD' ? 'د.ع' : currency}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
});

FloatingProductCard.displayName = 'FloatingProductCard';

export default FloatingProductCard;
