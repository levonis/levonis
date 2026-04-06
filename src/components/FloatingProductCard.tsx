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
          {/* Product image */}
          <div className="relative h-64 w-64 md:h-80 md:w-80 z-20" style={{ marginBottom: '-2.5rem' }}>
            <img
              src={imageUrl || '/placeholder.svg'}
              alt={nameAr}
              loading="eager"
              className="w-full h-full object-contain relative z-10"
            />
            {/* Contact shadow — tight at product base */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-48 h-4 md:w-60 md:h-5 rounded-[50%] bg-black/50 blur-md" />
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
          <div className="w-80 h-7 md:w-[26rem] md:h-9 mx-auto rounded-[50%] blur-2xl" style={{ marginTop: '-2px', background: 'radial-gradient(ellipse, hsl(160 40% 18% / 0.45), transparent 60%)' }} />

        </div>
      </Link>
    );
  }

  // Standard product — green gradient card
  return (
    <Link to={`/product/${slug}`} className="block group">
      <div className="product-card-green relative">
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
        <div className="p-4 pt-3 text-center space-y-1.5">
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
          {/* Discount badge — below price */}
          {discount > 0 && (
            <div className="flex items-center justify-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-destructive/90 text-destructive-foreground text-xs font-bold">
                -{discount}%
              </span>
              {originalPrice && (
                <span className="line-through text-[11px] text-muted-foreground">
                  {originalPrice.toLocaleString()} {currency === 'IQD' ? 'د.ع' : currency}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
});

FloatingProductCard.displayName = 'FloatingProductCard';

export default FloatingProductCard;
