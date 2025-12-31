import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, ShoppingCart, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";

interface ProductOfferCardProps {
  offer: {
    id: string;
    title_ar: string;
    description_ar: string | null;
    image_url: string | null;
    images: string[] | null;
    ticket_price: number; // Product price
    gift_tickets_per_purchase: number;
    currency: string;
  };
  onPurchase: (offerId: string) => void;
  isPurchasing: boolean;
  isAuthenticated: boolean;
  walletBalance: number;
}

export default function ProductOfferCard({
  offer,
  onPurchase,
  isPurchasing,
  isAuthenticated,
  walletBalance,
}: ProductOfferCardProps) {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  const images = offer.images && offer.images.length > 0 
    ? offer.images 
    : (offer.image_url ? [offer.image_url] : []);
  
  const hasMultipleImages = images.length > 1;
  const canAfford = walletBalance >= offer.ticket_price;
  const giftTickets = (offer as any).gift_tickets_per_purchase || 1;

  const navigateImage = (direction: 'prev' | 'next', e: React.MouseEvent) => {
    e.stopPropagation();
    if (direction === 'prev') {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    } else {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }
  };

  const handlePurchaseClick = () => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    onPurchase(offer.id);
  };

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-primary/10">
      <div className="relative aspect-square">
        {images.length > 0 ? (
          <OptimizedImage
            src={images[currentImageIndex]}
            alt={offer.title_ar}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground" />
          </div>
        )}

        {/* Gift Badge */}
        <Badge className="absolute top-2 right-2 bg-green-600 text-white gap-1 shadow-lg">
          <Gift className="h-3 w-3" />
          {giftTickets} تذكرة هدية
        </Badge>

        {/* Image Navigation */}
        {hasMultipleImages && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 bg-black/40 hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => navigateImage('prev', e)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 bg-black/40 hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => navigateImage('next', e)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentImageIndex ? 'bg-white' : 'bg-white/50'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(idx);
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <CardContent className="p-3 space-y-2">
        <h3 className="font-semibold text-sm line-clamp-2">{offer.title_ar}</h3>
        
        {offer.description_ar && (
          <p className="text-xs text-muted-foreground line-clamp-2">{offer.description_ar}</p>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <p className="font-bold text-primary">{offer.ticket_price.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{offer.currency || 'دينار'}</p>
          </div>
          
          <Button 
            size="sm" 
            className="gap-1"
            onClick={handlePurchaseClick}
            disabled={isPurchasing || (isAuthenticated && !canAfford)}
          >
            {isPurchasing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ShoppingCart className="h-3 w-3" />
            )}
            {!isAuthenticated ? 'سجّل دخول' : !canAfford ? 'رصيد غير كافٍ' : 'شراء'}
          </Button>
        </div>

        {/* Gift Info */}
        <div className="text-center py-2 bg-green-500/10 rounded-lg border border-green-500/20">
          <p className="text-xs text-green-700 dark:text-green-400 font-medium">
            🎁 مع كل شراء تحصل على {giftTickets} تذكرة مجاناً!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
