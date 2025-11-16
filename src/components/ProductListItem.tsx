import { Link } from 'react-router-dom';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { formatPrice } from '@/lib/utils';
import { resizeSupabaseImage } from '@/lib/imageUtils';

interface ProductListItemProps {
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
}

const ProductListItem = ({ 
  id, 
  name, 
  nameAr, 
  description, 
  descriptionAr, 
  price, 
  originalPrice, 
  imageUrl,
  images,
  currency = 'دينار عراقي',
  slug
}: ProductListItemProps) => {
  const hasSale = originalPrice && originalPrice > price;
  const savings = hasSale ? originalPrice - price : 0;
  const { addToCart } = useCart();
  
  const displayImage = (images && images.length > 0) ? images[0] : imageUrl;
  // Resize image to 300px for list item display
  const optimizedImage = resizeSupabaseImage(displayImage, 300);

  return (
    <Link 
      to={`/product/${slug}`}
      className="group flex gap-3 sm:gap-4 bg-gradient-to-b from-card to-card/80 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-border/40 card-premium hover:border-primary/50 transition-all hover:shadow-lg relative overflow-hidden"
    >
      {/* Image */}
      {optimizedImage && (
        <div className="relative overflow-hidden rounded-lg w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0">
          <img 
            src={optimizedImage} 
            alt={nameAr}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            width="112"
            height="112"
          />
          {hasSale && (
            <Badge 
              variant="secondary" 
              className="absolute top-1 left-1 sm:top-2 sm:left-2 text-xs bg-primary/90 text-primary-foreground border-0 shadow-lg"
            >
              تخفيضات
            </Badge>
          )}
        </div>
      )}
      
      {/* Content */}
      <div className="flex-1 flex flex-col justify-between min-w-0">
        <div>
          <h3 className="font-bold text-base sm:text-lg lg:text-xl mb-1 sm:mb-2 text-foreground group-hover:text-primary transition-colors line-clamp-1">
            {nameAr}
          </h3>
          
          {descriptionAr && (
            <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 line-clamp-2">
              {descriptionAr}
            </p>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-primary whitespace-nowrap">
                {formatPrice(price)}
              </span>
              <span className="text-xs sm:text-sm text-muted-foreground">
                {currency}
              </span>
            </div>
            {hasSale && (
              <div className="flex items-center gap-1.5 sm:gap-2 mt-1">
                <span className="text-xs sm:text-sm line-through text-muted-foreground/60">
                  {formatPrice(originalPrice || 0)}
                </span>
                <span className="text-xs sm:text-sm bg-primary/10 text-primary px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                  وفر {formatPrice(savings)}
                </span>
              </div>
            )}
          </div>
          
          <Button 
            size="default"
            className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90 w-full sm:w-auto text-sm"
            onClick={(e) => {
              e.preventDefault();
              addToCart(id);
            }}
          >
            <ShoppingCart className="h-4 w-4 ml-2" />
            أضف للسلة
          </Button>
        </div>
      </div>
    </Link>
  );
};

export default ProductListItem;
