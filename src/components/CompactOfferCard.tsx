import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, ShoppingCart } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";

interface CompactOfferCardProps {
  offer: {
    id: string;
    title_ar: string;
    image_url: string | null;
    images: string[] | null;
    price: number;
    currency: string;
    gift_tickets: number;
    stock_quantity: number | null;
  };
  onClick: () => void;
}

export default function CompactOfferCard({
  offer,
  onClick,
}: CompactOfferCardProps) {
  const [imageIndex, setImageIndex] = useState(0);
  
  const images = offer.images && offer.images.length > 0 
    ? offer.images 
    : (offer.image_url ? [offer.image_url] : []);
  
  const isOutOfStock = offer.stock_quantity !== null && offer.stock_quantity <= 0;

  return (
    <Card 
      className="overflow-hidden hover:shadow-md transition-all border-border/50 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
      onClick={onClick}
    >
      {/* Compact Image - smaller aspect ratio */}
      <div 
        className="relative aspect-[4/3]"
        onClick={(e) => {
          if (images.length > 1) {
            e.stopPropagation();
            setImageIndex((prev) => (prev + 1) % images.length);
          }
        }}
      >
        {images.length > 0 ? (
          <OptimizedImage
            src={images[imageIndex]}
            alt={offer.title_ar}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center">
            <ShoppingCart className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}
        
        {/* Gift Badge - smaller */}
        <Badge className="absolute top-1 right-1 bg-green-600 text-white text-[10px] px-1.5 py-0.5 gap-0.5">
          <Gift className="h-2.5 w-2.5" />
          +{offer.gift_tickets}
        </Badge>
        
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-xs font-bold">نفذت الكمية</span>
          </div>
        )}
        
        {/* Image dots */}
        {images.length > 1 && (
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
            {images.map((_, idx) => (
              <span 
                key={idx} 
                className={`w-1 h-1 rounded-full ${idx === imageIndex ? 'bg-white' : 'bg-white/40'}`} 
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Compact Content */}
      <div className="p-2 space-y-1">
        <h3 className="font-medium text-xs line-clamp-1">{offer.title_ar}</h3>
        
        <div className="flex items-center justify-between gap-1">
          <span className="font-bold text-primary text-sm">{offer.price.toLocaleString()}</span>
          <span className="text-[10px] text-muted-foreground">{offer.currency}</span>
        </div>
      </div>
    </Card>
  );
}
