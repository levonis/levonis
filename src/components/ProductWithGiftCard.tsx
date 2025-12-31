import { memo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, ShoppingBag, ChevronLeft, ChevronRight, Images, Ticket, Package, Sparkles, Info } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";

interface ProductWithGiftCardProps {
  competition: {
    id: string;
    title_ar: string;
    description_ar: string | null;
    image_url: string | null;
    images: string[] | null;
    prize_description_ar: string;
    prize_value: number | null;
    ticket_price: number;
    currency: string;
    gift_tickets_per_purchase?: number;
    is_featured?: boolean;
    product_id?: string | null;
    is_product_based?: boolean;
  };
  product?: {
    id: string;
    name_ar: string;
    price: number;
    image_url: string | null;
    description_ar: string | null;
  } | null;
  onPurchase: (competitionId: string) => void;
  isPurchasing: boolean;
  isAuthenticated: boolean;
  walletBalance: number;
}

const ProductWithGiftCard = memo(({
  competition,
  product,
  onPurchase,
  isPurchasing,
  isAuthenticated,
  walletBalance
}: ProductWithGiftCardProps) => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const compImages = competition.images?.length ? competition.images : (competition.image_url ? [competition.image_url] : []);
  const displayPrice = product?.price || competition.ticket_price;
  const giftTickets = competition.gift_tickets_per_purchase || 1;
  const canAfford = walletBalance >= displayPrice;

  const navigateImage = useCallback((direction: 'next' | 'prev') => {
    if (direction === 'next') {
      setCurrentImageIndex(prev => (prev + 1) % compImages.length);
    } else {
      setCurrentImageIndex(prev => (prev - 1 + compImages.length) % compImages.length);
    }
  }, [compImages.length]);

  const handlePurchaseClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    onPurchase(competition.id);
  }, [isAuthenticated, navigate, onPurchase, competition.id]);

  return (
    <Card 
      className={`overflow-hidden hover:shadow-md transition-all ${
        competition.is_featured 
          ? 'ring-2 ring-primary/50 shadow-lg shadow-primary/20 relative' 
          : ''
      }`}
    >
      {/* Featured badge */}
      {competition.is_featured && (
        <div className="absolute top-0 left-0 z-20 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-br-lg flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          مميز
        </div>
      )}
      
      {compImages.length > 0 && (
        <div className="relative h-36 md:h-40 overflow-hidden group">
          <OptimizedImage
            src={compImages[currentImageIndex]}
            alt={competition.title_ar}
            className="absolute inset-0 w-full h-full"
          />
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
          
          {compImages.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage('prev');
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage('next');
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
                {compImages.map((_, idx) => (
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
                {currentImageIndex + 1}/{compImages.length}
              </Badge>
            </>
          )}
          
          {/* Gift tickets badge */}
          <Badge className="absolute top-2 right-2 text-xs px-2 py-1 bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0">
            <Gift className="h-3 w-3 ml-1" />
            +{giftTickets} تذكرة هدية
          </Badge>
        </div>
      )}
      
      <CardContent className="p-2 sm:p-3 space-y-1.5 sm:space-y-2">
        {/* Product Title */}
        <h3 className="font-bold text-xs sm:text-sm line-clamp-2">{competition.title_ar}</h3>
        
        {/* Product Description */}
        <div className="bg-gradient-to-l from-primary/10 to-transparent rounded-md p-1.5 sm:p-2 border-r-2 border-primary/50">
          <div className="flex items-start gap-1 sm:gap-1.5">
            <Package className="h-3 w-3 sm:h-3.5 sm:w-3.5 mt-0.5 flex-shrink-0 text-primary" />
            <span className="text-[10px] sm:text-xs font-medium text-foreground leading-relaxed line-clamp-2">
              {competition.prize_description_ar}
            </span>
          </div>
        </div>

        {/* Gift Notice */}
        <div className="bg-gradient-to-l from-emerald-500/10 to-transparent rounded-md p-1.5 sm:p-2 border-r-2 border-emerald-500/50">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <Gift className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0 text-emerald-600" />
            <span className="text-[10px] sm:text-xs font-medium text-emerald-700 dark:text-emerald-400">
              مع كل شراء: {giftTickets} تذكرة مجانية هدية!
            </span>
          </div>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex flex-col">
            <span className="text-lg sm:text-xl font-bold text-primary">
              {displayPrice.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground">{competition.currency}</span>
          </div>
          
          <Button
            size="sm"
            className="gap-1 text-xs"
            onClick={handlePurchaseClick}
            disabled={isPurchasing || !canAfford}
          >
            <ShoppingBag className="h-3 w-3" />
            شراء المنتج
          </Button>
        </div>

        {!canAfford && isAuthenticated && (
          <p className="text-[10px] text-destructive text-center">
            رصيد غير كافٍ
          </p>
        )}
      </CardContent>
    </Card>
  );
});

ProductWithGiftCard.displayName = 'ProductWithGiftCard';

export default ProductWithGiftCard;
