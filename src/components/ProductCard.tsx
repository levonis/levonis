import { Link } from 'react-router-dom';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { formatPrice } from '@/lib/utils';

interface ProductCardProps {
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

const ProductCard = ({ 
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
}: ProductCardProps) => {
  const hasSale = originalPrice && originalPrice > price;
  const savings = hasSale ? originalPrice - price : 0;
  const { addToCart } = useCart();
  
  const displayImage = (images && images.length > 0) ? images[0] : imageUrl;

  return (
    <Link 
      to={`/product/${slug}`}
      className="group block bg-gradient-to-b from-card to-card/80 rounded-2xl p-4 border border-border/40 card-premium hover:border-primary/50 transition-all hover:-translate-y-1 relative overflow-hidden"
    >
      {/* Decorative corner accent */}
      <div className="absolute top-0 right-0 w-16 h-16 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <svg viewBox="0 0 50 50" className="w-full h-full">
          <path d="M0,0 L50,0 L50,20 Q40,20 40,10 Z" fill="hsl(var(--ring) / 0.1)" />
        </svg>
      </div>
      {displayImage && (
        <div className="relative overflow-hidden rounded-xl mb-3 aspect-square">
          <img 
            src={displayImage} 
            alt={nameAr}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {hasSale && (
            <Badge 
              variant="secondary" 
              className="absolute top-2 left-2 bg-primary/90 text-primary-foreground border-0 shadow-lg"
            >
              تخفيضات
            </Badge>
          )}
        </div>
      )}
      
      <h3 className="font-bold text-lg mb-1 text-foreground group-hover:text-primary transition-colors">
        {nameAr}
      </h3>
      
      {descriptionAr && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {descriptionAr}
        </p>
      )}
      
      <div className="flex items-center justify-between gap-2 mt-auto">
        <div className="flex flex-col">
          <span className="text-xl font-black text-primary">
            {formatPrice(price)} {currency}
          </span>
          {hasSale && (
            <div className="flex items-center gap-2">
              <span className="text-sm line-through text-muted-foreground/60">
                {formatPrice(originalPrice || 0)} {currency}
              </span>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                وفر {formatPrice(savings)}
              </span>
            </div>
          )}
        </div>
        
        <Button 
          size="sm"
          className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
          onClick={(e) => {
            e.preventDefault();
            addToCart(id);
          }}
        >
          <ShoppingCart className="h-4 w-4" />
        </Button>
      </div>
    </Link>
  );
};

export default ProductCard;