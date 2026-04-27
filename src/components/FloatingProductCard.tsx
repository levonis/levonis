import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getLocalizedField } from '@/hooks/useLocalizedProduct';
import { useLanguage } from '@/lib/i18n';
import { resizeSupabaseImage } from '@/lib/imageUtils';
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
  /**
   * Live-computed direct sale price (in IQD) for products linked to global COD %.
   * When provided (>0), overrides `price` so the card always shows the up-to-date
   * value reflecting the current COD setting / exchange rate — no reload needed.
   */
  directSalePriceLive?: number | null;
  /** When set, highlights matches of this query inside the product name. */
  highlightQuery?: string;
}

/** Split text into segments, marking matches of `query` (case-insensitive). */
const renderHighlighted = (text: string, query: string) => {
  const q = (query || '').trim();
  if (!q || !text) return text;
  // Match either the full query OR any single token, longest-first.
  const tokens = Array.from(new Set([q, ...q.split(/\s+/).filter(Boolean)]))
    .filter((t) => t.length > 0)
    .sort((a, b) => b.length - a.length);
  if (tokens.length === 0) return text;
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${tokens.map(escape).join('|')})`, 'gi');
  const parts = text.split(re);
  const matchSet = new Set(tokens.map((t) => t.toLowerCase()));
  return parts.map((part, i) =>
    matchSet.has(part.toLowerCase()) ? (
      <mark
        key={i}
        className="bg-primary/25 text-primary rounded px-0.5 font-extrabold"
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
};

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
  directSalePriceLive = null,
  highlightQuery = '',
}: FloatingProductCardProps) => {
  const { language } = useLanguage();
  const localProduct = { name_ar: nameAr, name_en: nameEn, name_ku: nameKu };
  const displayName = getLocalizedField(localProduct, 'name', language);
  // Prefer live direct sale price when product is linked to global COD %
  const displayPrice = directSalePriceLive != null && directSalePriceLive > 0
    ? directSalePriceLive
    : price;
  const discount = originalPrice && originalPrice > displayPrice
    ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100)
    : 0;

  const featuredSrc = useMemo(
    () => (imageUrl ? resizeSupabaseImage(imageUrl, 600, 80) || imageUrl : '/placeholder.svg'),
    [imageUrl]
  );
  const standardSrc = useMemo(
    () => (imageUrl ? resizeSupabaseImage(imageUrl, 400, 75) || imageUrl : '/placeholder.svg'),
    [imageUrl]
  );

  if (featured) {
    return (
      <Link to={`/product/${slug}`} className="block">
        <div className="flex flex-col items-center">
          {/* Product image */}
          <div className="relative h-28 w-28 sm:h-48 sm:w-48 md:h-80 md:w-80 z-20 mb-[-1rem] sm:mb-[-2.5rem]">
            <img
              src={featuredSrc}
               alt={displayName}
              loading="eager"
              decoding="async"
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
                {displayPrice.toLocaleString()} {currency === 'IQD' ? 'د.ع' : currency}
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

  // Standard product — image-fill glass card
  return (
    <Link to={`/product/${slug}`} className="block group h-full">
      <div className="relative h-full flex flex-col rounded-2xl overflow-hidden isolate glass-panel transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-[0_12px_40px_-12px_hsl(var(--primary)/0.35),inset_0_1px_0_hsl(0_0%_100%/0.12)]">
        {hasDirectSale && <DirectSaleRibbon />}
        {/* Product image — fills the card top, no padding */}
        <div className="relative aspect-square overflow-hidden flex-shrink-0">
          <img
            src={imageUrl || '/placeholder.svg'}
            alt={displayName}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          {/* Discount badge */}
          {discount > 0 && (
            <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-destructive/85 backdrop-blur-md text-destructive-foreground text-[9px] font-bold border border-white/15 shadow-[0_2px_8px_hsl(var(--destructive)/0.4)]">
              -{discount}%
            </span>
          )}
        </div>

        {/* Product info */}
        <div className="p-2.5 pt-2 text-center space-y-1 flex-1 flex flex-col justify-center">
          <h3 className="text-[11px] md:text-sm font-bold text-foreground/85 leading-tight line-clamp-2">
            {highlightQuery ? renderHighlighted(displayName, highlightQuery) : displayName}
          </h3>
          <div className="flex items-center justify-center gap-1">
            <span className="text-sm md:text-base font-black text-primary">
              {displayPrice.toLocaleString()}
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
