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

  if (featured) {
    return (
      <Link to={`/product/${slug}`} className="block">
        <div className="flex flex-col items-center">
          {/* Discount badge */}
          {discount > 0 && (
            <div className="mb-2 px-3 py-1 rounded-full bg-destructive/90 text-destructive-foreground text-xs font-bold">
              -{discount}%
            </div>
          )}

          {/* Product image */}
          <div className="relative h-64 w-64 md:h-80 md:w-80">
            <img
              src={imageUrl || '/placeholder.svg'}
              alt={nameAr}
              loading="eager"
              className="w-full h-full object-contain relative z-10"
            />
          </div>

          {/* Contact shadow — product base (dense ellipse) */}
          <div className="w-56 h-6 md:w-72 md:h-7 mx-auto rounded-[50%] bg-black/55 blur-lg" style={{ marginTop: '-14px' }} />

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
          {/* 3D Block — front face */}
          <div className="cube-front-featured" />
          {/* 3D Block — bottom edge highlight */}
          <div className="cube-bottom-edge" />
          {/* Bottom reflection strip */}
          <div className="cube-bottom-reflection" />

          {/* Ground reflection (larger) */}
          <div className="w-80 h-7 md:w-[26rem] md:h-9 mx-auto rounded-[50%] blur-2xl" style={{ marginTop: '-2px', background: 'radial-gradient(ellipse, hsl(160 40% 18% / 0.45), transparent 60%)' }} />

          {/* Product info */}
          <div className="mt-6 text-center space-y-1.5">
            <h3 className="text-lg md:text-xl font-semibold text-foreground/85 leading-tight line-clamp-2">
              {nameAr}
            </h3>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-xl md:text-2xl font-black text-primary">
                {price.toLocaleString()}
              </span>
              <span className="text-xs text-primary/60">
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
  }

  // Standard product — green gradient card
  return (
    <Link to={`/product/${slug}`} className="block group">
      <div className="product-card-green">
        {/* Discount badge */}
        {discount > 0 && (
          <div className="absolute top-3 right-3 z-20 px-2 py-0.5 rounded-full bg-destructive/90 text-destructive-foreground text-xs font-bold">
            -{discount}%
          </div>
        )}

        {/* Product image area */}
        <div className="relative h-40 md:h-48 flex items-end justify-center px-4 pt-4 pb-2">
          <img
            src={imageUrl || '/placeholder.svg'}
            alt={nameAr}
            loading="lazy"
            className="max-h-full max-w-full object-contain relative z-10"
          />
        </div>

        {/* Floor line */}
        <div className="mx-4 h-px bg-white/10" />

        {/* Product info */}
        <div className="p-4 pt-3 text-center space-y-1">
          <h3 className="text-sm md:text-base font-semibold text-foreground/85 leading-tight line-clamp-2">
            {nameAr}
          </h3>
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-base md:text-lg font-black text-primary">
              {price.toLocaleString()}
            </span>
            <span className="text-[10px] text-primary/60">
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
