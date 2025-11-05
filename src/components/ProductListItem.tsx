import { Link } from 'react-router-dom';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { formatPrice } from '@/lib/utils';

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

  return (
    <Link 
      to={`/product/${slug}`}
      className="group flex gap-4 bg-gradient-to-b from-card to-card/80 rounded-xl p-4 border border-border/40 card-premium hover:border-primary/50 transition-all hover:shadow-lg relative overflow-hidden"
    >
      {/* Image */}
      {displayImage && (
        <div className="relative overflow-hidden rounded-lg w-32 h-32 flex-shrink-0">
          <img 
            src={displayImage} 
            alt={nameAr}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {hasSale && (
            <Badge 
              variant="secondary" 
              className="absolute top-2 left-2 text-xs bg-primary/90 text-primary-foreground border-0 shadow-lg"
            >
              تخفيضات
            </Badge>
          )}
        </div>
      )}
      
      {/* Content */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-xl mb-2 text-foreground group-hover:text-primary transition-colors">
            {nameAr}
          </h3>
          
          {descriptionAr && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {descriptionAr}
            </p>
          )}
        </div>
        
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-2xl font-black text-primary">
              {formatPrice(price)} {currency}
            </span>
            {hasSale && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm line-through text-muted-foreground/60">
                  {formatPrice(originalPrice || 0)}
                </span>
                <span className="text-sm bg-primary/10 text-primary px-2 py-1 rounded-full">
                  وفر {formatPrice(savings)}
                </span>
              </div>
            )}
          </div>
          
          <Button 
            size="default"
            className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
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
