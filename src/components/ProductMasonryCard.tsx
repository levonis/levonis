import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice } from '@/lib/utils';
import { resizeSupabaseImage, IMAGE_QUALITY, IMAGE_SIZES } from '@/lib/imageUtils';

interface ProductMasonryCardProps {
  id: string;
  name_ar: string;
  price: number;
  original_price?: number | null;
  image_url?: string | null;
  images?: string[] | null;
  currency?: string | null;
  slug: string;
  in_stock?: boolean;
  isTall?: boolean;
}

const ProductMasonryCard = memo(({ name_ar, price, original_price, image_url, images, currency, slug, in_stock = true, isTall = false }: ProductMasonryCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const displayImage = (images && images.length > 0) ? images[0] : image_url;
  const optimizedImage = resizeSupabaseImage(displayImage, IMAGE_SIZES.card, IMAGE_QUALITY.medium);
  const hasSale = original_price && original_price > price;

  return (
    <Link
      to={`/product/${slug}`}
      className={`group relative block rounded-2xl overflow-hidden bg-white/[0.07] backdrop-blur-sm border border-white/10 hover:border-white/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] ${isTall ? 'row-span-2' : ''}`}
    >
      {/* Card inner */}
      <div className="flex flex-col h-full">
        {/* Image container */}
        <div className={`relative flex items-center justify-center p-4 ${isTall ? 'flex-1 min-h-[200px]' : 'min-h-[150px]'}`}>
          {/* Top light effect */}
          <div className="absolute top-0 inset-x-0 h-1/3 bg-gradient-to-b from-white/[0.06] to-transparent" />
          
          {/* Shadow under image */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[60%] h-4 bg-black/20 rounded-[50%] blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
          
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
            </div>
          )}
          
          <img
            src={optimizedImage || '/placeholder.svg'}
            alt={name_ar}
            className={`max-w-[85%] max-h-[85%] object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)] transition-all duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_15px_30px_rgba(0,0,0,0.4)] ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
            loading="lazy"
          />

          {!in_stock && (
            <div className="absolute top-2 right-2 bg-red-500/80 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
              نفذ
            </div>
          )}

          {hasSale && (
            <div className="absolute top-2 left-2 bg-amber-500/90 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm font-bold">
              خصم
            </div>
          )}
        </div>

        {/* Info section */}
        <div className="p-3 pt-1 space-y-1 border-t border-white/[0.06]">
          <h3 className="text-white text-xs font-medium leading-tight line-clamp-2 text-right">
            {name_ar}
          </h3>
          <div className="flex items-center gap-1.5 justify-end flex-wrap">
            <span className="text-white/90 text-xs font-bold">
              {formatPrice(price)}
            </span>
            {hasSale && (
              <span className="text-white/30 text-[10px] line-through">
                {formatPrice(original_price!)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
});

ProductMasonryCard.displayName = 'ProductMasonryCard';

export default ProductMasonryCard;
