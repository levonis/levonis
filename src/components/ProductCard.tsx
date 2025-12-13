import { Link } from 'react-router-dom';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Heart } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { resizeSupabaseImage } from '@/lib/imageUtils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

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
  priority?: boolean;
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
  slug,
  priority = false
}: ProductCardProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const hasSale = originalPrice && originalPrice > price;
  const savings = hasSale ? originalPrice - price : 0;
  
  const displayImage = (images && images.length > 0) ? images[0] : imageUrl;
  // Resize image to 400px for card display
  const optimizedImage = resizeSupabaseImage(displayImage, 400);

  const handleAddToFavorites = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('يرجى تسجيل الدخول أولاً');
        return;
      }

      // Check if already in favorites
      const { data: existing } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', id)
        .maybeSingle();

      if (existing) {
        toast.info('المنتج موجود بالفعل في المفضلة');
        return;
      }

      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, product_id: id });

      if (error) throw error;
      toast.success('تمت الإضافة إلى المفضلة');
    } catch (error) {
      console.error('Error adding to favorites:', error);
      toast.error('حدث خطأ أثناء الإضافة للمفضلة');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Link 
      to={`/product/${slug}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="group block bg-gradient-to-b from-card to-card/80 rounded-xl p-2.5 border border-border/40 card-premium hover:border-primary/50 transition-all hover:-translate-y-1 relative overflow-hidden"
    >
      {/* Decorative corner accent */}
      <div className="absolute top-0 right-0 w-12 h-12 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <svg viewBox="0 0 50 50" className="w-full h-full">
          <path d="M0,0 L50,0 L50,20 Q40,20 40,10 Z" fill="hsl(var(--ring) / 0.1)" />
        </svg>
      </div>
      
      {/* Sale badge - above image */}
      {hasSale && (
        <Badge 
          variant="secondary" 
          className="absolute top-1 left-1 z-20 text-xs bg-primary/90 text-primary-foreground border-0 shadow-lg px-2 py-0.5"
        >
          تخفيضات
        </Badge>
      )}

      <div className="relative mb-2">
        <div className="relative overflow-hidden rounded-lg aspect-square bg-muted/30">
          <img 
            src={optimizedImage || '/placeholder.svg'} 
            alt={nameAr}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            width="400"
            height="400"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              target.src = '/placeholder.svg';
            }}
          />
        </div>
      </div>
      
      <h3 className="font-bold text-sm mb-1 text-foreground group-hover:text-primary transition-colors line-clamp-1">
        {nameAr}
      </h3>
      
      {descriptionAr && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
          {descriptionAr}
        </p>
      )}
      
      <div className="flex items-center justify-between gap-2 mt-auto">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-1">
            <span className="text-base font-black text-primary whitespace-nowrap">
              {formatPrice(price)}
            </span>
            <span className="text-xs text-muted-foreground">
              {currency}
            </span>
          </div>
          {hasSale && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs line-through text-muted-foreground/60 whitespace-nowrap">
                {formatPrice(originalPrice || 0)}
              </span>
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full whitespace-nowrap">
                وفر {formatPrice(savings)}
              </span>
            </div>
          )}
        </div>
        
        <Button 
          size="sm"
          className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90 h-8 w-8 p-0 flex-shrink-0"
          onClick={handleAddToFavorites}
          disabled={isAdding}
          aria-label="أضف للمفضلة"
        >
          <Heart className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Link>
  );
};

export default ProductCard;