import { Link } from 'react-router-dom';
import { formatPrice } from '@/lib/utils';
import { resizeSupabaseImage } from '@/lib/imageUtils';
import { Button } from './ui/button';
import { ArrowLeft } from 'lucide-react';

interface ProductHeroCardProps {
  id: string;
  name_ar: string;
  description_ar?: string | null;
  price: number;
  original_price?: number | null;
  image_url?: string | null;
  images?: string[] | null;
  currency?: string | null;
  slug: string;
}

const ProductHeroCard = ({ name_ar, description_ar, price, original_price, image_url, images, currency, slug }: ProductHeroCardProps) => {
  const displayImage = (images && images.length > 0) ? images[0] : image_url;
  const optimizedImage = resizeSupabaseImage(displayImage, 600, 85);
  const hasSale = original_price && original_price > price;

  return (
    <section className="relative rounded-3xl overflow-hidden mb-8" dir="rtl">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-bl from-white/[0.08] via-transparent to-white/[0.03]" />
      
      <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-10 p-6 md:p-10 lg:p-14">
        {/* Right side - Product image with 3D effect */}
        <div className="relative flex-shrink-0 w-full md:w-[45%] flex items-center justify-center">
          {/* Lighting effect */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[40%] bg-gradient-radial from-white/20 via-white/5 to-transparent rounded-full blur-2xl" />
          
          {/* Shadow under product */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-6 bg-black/30 rounded-[50%] blur-xl" />
          
          <div className="relative" style={{ transform: 'perspective(800px) rotateY(-5deg)' }}>
            <img
              src={optimizedImage || '/placeholder.svg'}
              alt={name_ar}
              className="w-full max-w-[320px] md:max-w-[380px] h-auto object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-transform duration-500 hover:scale-105"
              loading="eager"
            />
          </div>
        </div>

        {/* Left side - Text content */}
        <div className="flex-1 text-center md:text-right space-y-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight font-[Amiri,serif]">
            {name_ar}
          </h2>
          
          {description_ar && (
            <p className="text-white/70 text-sm md:text-base leading-relaxed line-clamp-3 max-w-lg">
              {description_ar}
            </p>
          )}

          <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap">
            <span className="text-xl md:text-2xl font-bold text-white">
              {formatPrice(price)} <span className="text-sm text-white/60">{currency || 'دينار عراقي'}</span>
            </span>
            {hasSale && (
              <span className="text-base text-white/40 line-through">
                {formatPrice(original_price!)}
              </span>
            )}
          </div>

          <Link to={`/product/${slug}`}>
            <Button 
              size="lg"
              className="mt-2 bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-sm rounded-xl px-8 gap-2 transition-all duration-300 hover:scale-105"
            >
              عرض المنتج
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ProductHeroCard;
