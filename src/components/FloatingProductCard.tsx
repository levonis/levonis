import { memo } from 'react';
import { Link } from 'react-router-dom';

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
  const discount = originalPrice && originalPrice > price
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

  return (
    <Link
      to={`/product/${slug}`}
      className="block"
    >
      <div className="flex flex-col items-center">
        {/* Product image area */}
        <div className={`relative mx-auto ${featured ? 'h-56 w-56 md:h-72 md:w-72' : 'h-36 w-36 md:h-44 md:w-44'}`}>
          {/* Discount badge */}
          {discount > 0 && (
            <div className="absolute top-0 right-0 z-20 px-2 py-0.5 rounded-full bg-destructive/90 text-destructive-foreground text-xs font-bold">
              -{discount}%
            </div>
          )}

          {/* Product image — static, no animation */}
          <img
            src={imageUrl || '/placeholder.svg'}
            alt={nameAr}
            loading={featured ? 'eager' : 'lazy'}
            className="relative z-10 w-full h-full object-contain"
          />
        </div>

        {/* Contact shadow — where product meets platform */}
        <div
          className={`mx-auto rounded-[50%] ${
            featured
              ? 'w-44 h-3 md:w-56 md:h-4 bg-black/30 blur-md'
              : 'w-24 h-2 md:w-32 md:h-3 bg-black/25 blur-sm'
          }`}
          style={{ marginTop: '-6px' }}
        />

        {/* 3D Pedestal / Platform */}
        <div className={`pedestal-wrapper ${featured ? 'pedestal-featured' : ''}`}>
          {/* Top face */}
          <div className={`pedestal-top ${featured ? 'pedestal-top-featured' : ''}`} />
          {/* Front face */}
          <div className={`pedestal-front ${featured ? 'pedestal-front-featured' : ''}`} />
        </div>

        {/* Ground shadow under pedestal */}
        <div
          className={`mx-auto rounded-[50%] ${
            featured
              ? 'w-52 h-3 md:w-64 md:h-4 bg-black/15 blur-lg'
              : 'w-32 h-2 md:w-40 md:h-3 bg-black/10 blur-md'
          }`}
          style={{ marginTop: '-2px' }}
        />

        {/* Product info */}
        <div className={`mt-4 text-center space-y-1.5 ${featured ? 'mt-6' : ''}`}>
          <h3 className={`font-semibold text-foreground/85 leading-tight line-clamp-2 ${
            featured ? 'text-lg md:text-xl' : 'text-sm md:text-base'
          }`}>
            {nameAr}
          </h3>

          <div className="flex items-center justify-center gap-1.5">
            <span className={`font-black text-primary ${
              featured ? 'text-xl md:text-2xl' : 'text-base md:text-lg'
            }`}>
              {price.toLocaleString()}
            </span>
            <span className={`text-primary/60 ${featured ? 'text-xs' : 'text-[10px]'}`}>
              {currency === 'IQD' ? 'د.ع' : currency}
            </span>
          </div>

          {originalPrice && originalPrice > price && (
            <span className="text-muted-foreground/50 line-through text-xs">
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
