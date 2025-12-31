import { memo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Package, ShoppingBag, ChevronLeft, ChevronRight, Images, Loader2, Sparkles, CheckCircle, Info } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";

interface ProductGiftCardProps {
  product: {
    id: string;
    title_ar: string;
    description_ar: string | null;
    image_url: string | null;
    images: string[] | null;
    price: number;
    currency: string;
    gift_tickets: number;
    is_featured?: boolean;
    legal_disclaimer?: string;
    product_id?: string;
    prize_description_ar?: string;
  };
  onPurchase: (productId: string) => void;
  isPurchasing: boolean;
  isAuthenticated: boolean;
  userBalance: number;
  alreadyPurchased?: boolean;
}

const ProductGiftCard = memo(({
  product,
  onPurchase,
  isPurchasing,
  isAuthenticated,
  userBalance,
  alreadyPurchased = false,
}: ProductGiftCardProps) => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const canAfford = userBalance >= product.price;
  const images = product.images?.length ? product.images : (product.image_url ? [product.image_url] : []);

  const navigateImage = useCallback((direction: 'next' | 'prev', e: React.MouseEvent) => {
    e.stopPropagation();
    if (direction === 'next') {
      setCurrentImageIndex(prev => (prev + 1) % images.length);
    } else {
      setCurrentImageIndex(prev => (prev - 1 + images.length) % images.length);
    }
  }, [images.length]);

  const handlePurchaseClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    onPurchase(product.id);
  }, [isAuthenticated, navigate, onPurchase, product.id]);

  return (
    <Card 
      className={`overflow-hidden hover:shadow-lg transition-all ${
        product.is_featured 
          ? 'ring-2 ring-primary/50 shadow-lg shadow-primary/20' 
          : ''
      }`}
    >
      {/* Featured badge */}
      {product.is_featured && (
        <div className="absolute top-0 left-0 z-20 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-br-lg flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          مميز
        </div>
      )}
      
      {/* Image Section */}
      {images.length > 0 && (
        <div className="relative h-40 md:h-48 overflow-hidden group">
          <OptimizedImage
            src={images[currentImageIndex]}
            alt={product.title_ar}
            className="absolute inset-0 w-full h-full"
          />
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full"
                onClick={(e) => navigateImage('prev', e)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full"
                onClick={(e) => navigateImage('next', e)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(idx);
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === currentImageIndex ? 'bg-white w-4' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
              
              <Badge className="absolute top-2 left-2 bg-black/40 backdrop-blur-sm text-white gap-1 text-xs px-2 py-1 border-0">
                <Images className="h-3 w-3" />
                {currentImageIndex + 1}/{images.length}
              </Badge>
            </>
          )}
          
          {/* Gift Tickets Badge - Always visible */}
          <Badge className="absolute top-2 right-2 text-xs px-3 py-1.5 bg-green-600/90 backdrop-blur-sm text-white border-0 shadow-lg">
            <Gift className="h-4 w-4 ml-1" />
            هدية: {product.gift_tickets} تذكرة مجانية
          </Badge>

          {/* Already Purchased Overlay */}
          {alreadyPurchased && (
            <div className="absolute inset-0 bg-green-600/80 flex items-center justify-center">
              <div className="flex flex-col items-center text-white">
                <CheckCircle className="h-10 w-10" />
                <span className="text-sm font-bold mt-1">تم الشراء</span>
              </div>
            </div>
          )}
        </div>
      )}
      
      <CardContent className="p-3 sm:p-4 space-y-3">
        {/* Product Title */}
        <h3 className="font-bold text-sm sm:text-base line-clamp-2">{product.title_ar}</h3>
        
        {/* Product Description */}
        {product.description_ar && (
          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
            {product.description_ar}
          </p>
        )}
        
        {/* Prize Description if available */}
        {product.prize_description_ar && (
          <div className="bg-gradient-to-l from-primary/10 to-transparent rounded-md p-2 border-r-2 border-primary/50">
            <div className="flex items-start gap-1.5">
              <Package className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" />
              <span className="text-xs font-medium text-foreground line-clamp-2">
                {product.prize_description_ar}
              </span>
            </div>
          </div>
        )}

        {/* Gift Highlight Box */}
        <div className="bg-gradient-to-l from-green-500/10 to-green-500/5 rounded-lg p-3 border border-green-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="h-5 w-5 text-green-600" />
            <span className="font-bold text-green-700 text-sm">هدية مجانية مع الشراء!</span>
          </div>
          <p className="text-xs text-green-600">
            عند شراء هذا المنتج، تحصل على <span className="font-bold">{product.gift_tickets} تذكرة مجانية</span> كهدية
          </p>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg sm:text-xl font-bold text-primary">
              {product.price.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground mr-1">{product.currency}</span>
          </div>
        </div>

        {/* Legal Disclaimer */}
        <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground bg-muted/50 rounded p-2">
          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>{product.legal_disclaimer || 'الشراء يتم على منتجات حقيقية، والتذاكر هدية مجانية مرفقة.'}</span>
        </div>

        {/* Purchase Button */}
        <Button
          className="w-full gap-2"
          onClick={handlePurchaseClick}
          disabled={isPurchasing || (isAuthenticated && !canAfford) || alreadyPurchased}
          variant={alreadyPurchased ? "secondary" : "default"}
        >
          {isPurchasing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري الشراء...
            </>
          ) : alreadyPurchased ? (
            <>
              <CheckCircle className="h-4 w-4" />
              تم شراء المنتج
            </>
          ) : !isAuthenticated ? (
            <>
              <ShoppingBag className="h-4 w-4" />
              سجل دخول للشراء
            </>
          ) : !canAfford ? (
            <>
              <ShoppingBag className="h-4 w-4" />
              الرصيد غير كافي
            </>
          ) : (
            <>
              <ShoppingBag className="h-4 w-4" />
              شراء المنتج
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
});

ProductGiftCard.displayName = 'ProductGiftCard';

export default ProductGiftCard;
