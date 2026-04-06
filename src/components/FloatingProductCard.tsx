import { memo } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n';

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
}

const FloatingProductCard = memo(({
  nameAr,
  price,
  originalPrice,
  imageUrl,
  currency = 'IQD',
  slug,
  featured = false,
}: FloatingProductCardProps) => {
  const { t } = useLanguage();

  const discount = originalPrice && originalPrice > price
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

  return (
    <Link
      to={`/product/${slug}`}
      className={`group block ${featured ? 'floating-card-featured' : 'floating-card'}`}
    >
      <div className={`relative ${featured ? 'p-8' : 'p-5'}`}>
        {/* Discount badge */}
        {discount > 0 && (
          <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full bg-destructive/90 text-destructive-foreground text-xs font-bold backdrop-blur-sm">
            -{discount}%
          </div>
        )}

        {/* Floating product image */}
        <div className={`relative mx-auto ${featured ? 'h-64 w-64 md:h-80 md:w-80' : 'h-40 w-40 md:h-48 md:w-48'}`}>
          {/* Ellipse shadow under product */}
          <div
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 rounded-[50%] bg-black/25 blur-xl transition-all duration-500 group-hover:bg-black/15 group-hover:blur-2xl group-hover:scale-90 ${
              featured ? 'w-48 h-8 md:w-64 md:h-10' : 'w-28 h-5 md:w-36 md:h-6'
            }`}
          />

          {/* Product image */}
          <img
            src={imageUrl || '/placeholder.svg'}
            alt={nameAr}
            loading={featured ? 'eager' : 'lazy'}
            className={`relative z-10 w-full h-full object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.3)] transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] group-hover:-translate-y-3 group-hover:scale-105 group-hover:drop-shadow-[0_30px_60px_rgba(0,0,0,0.4)] ${
              featured ? 'animate-[product-float_4s_ease-in-out_infinite]' : ''
            }`}
          />
        </div>

        {/* Product info */}
        <div className={`mt-6 text-center space-y-2 ${featured ? 'mt-8' : ''}`}>
          <h3 className={`font-bold text-foreground/90 leading-tight line-clamp-2 ${
            featured ? 'text-xl md:text-2xl' : 'text-sm md:text-base'
          }`}>
            {nameAr}
          </h3>
          
          <div className="flex items-center justify-center gap-2">
            <span className={`font-black text-primary ${
              featured ? 'text-2xl md:text-3xl' : 'text-lg md:text-xl'
            }`}>
              {price.toLocaleString()}
            </span>
            <span className={`text-primary/70 ${featured ? 'text-sm' : 'text-xs'}`}>
              {currency === 'IQD' ? 'د.ع' : currency}
            </span>
          </div>

          {originalPrice && originalPrice > price && (
            <span className="text-muted-foreground/60 line-through text-sm">
              {originalPrice.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
});

FloatingProductCard.displayName = 'FloatingProductCard';

export default FloatingProductCard;
