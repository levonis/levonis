import { Package, ShoppingCart, Edit, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ChatRole = 'seller' | 'customer';

interface ProductCardProps {
  productId: string;
  storeId: string;
  imageUrl?: string | null;
  title: string;
  price: number;
  currency?: string;
  isMe: boolean;
  timestamp: string;
  userRole?: ChatRole;
  canCreateOrder?: boolean;
  onCreateOrder?: () => void;
  onEditOrder?: () => void;
  onProductClick?: (productId: string) => void;
}

export default function ProductCard({
  productId,
  storeId,
  imageUrl,
  title,
  price,
  currency = 'د.ع',
  isMe,
  timestamp,
  userRole = 'customer',
  canCreateOrder = false,
  onCreateOrder,
  onEditOrder,
  onProductClick,
}: ProductCardProps) {
  return (
    <div className={cn("flex my-2", isMe ? "justify-start" : "justify-end")}>
      <div className="w-[250px] rounded-2xl overflow-hidden border border-primary/20 bg-gradient-to-b from-card to-background shadow-md">
        {/* Product Image */}
        <div
          className="relative h-32 bg-background cursor-pointer group overflow-hidden"
          onClick={() => onProductClick?.(productId)}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Package className="h-10 w-10 text-primary/20" />
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          
          {/* Badge top-start */}
          <div className="absolute top-2 start-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-card/80 backdrop-blur-sm border border-primary/20">
            <Sparkles className="h-2.5 w-2.5 text-primary" />
            <span className="text-[9px] font-bold text-primary">منتج</span>
          </div>

          {/* View button top-end */}
          <button
            onClick={(e) => { e.stopPropagation(); onProductClick?.(productId); }}
            className="absolute top-2 end-2 p-1.5 rounded-full bg-card/60 backdrop-blur-sm border border-primary/15 text-foreground/70 hover:text-primary hover:border-primary/40 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
          </button>

          {/* Price overlay bottom */}
          <div className="absolute bottom-0 inset-x-0 px-3 py-2">
            <p className="text-base font-black text-foreground drop-shadow-sm">
              {price.toLocaleString()}
              <span className="text-[10px] font-medium text-primary mr-1">{currency}</span>
            </p>
          </div>
        </div>

        {/* Product Info */}
        <div className="px-3 pt-1.5 pb-2 space-y-2">
          <h3
            className="font-bold text-[13px] leading-snug line-clamp-2 text-foreground cursor-pointer hover:text-primary transition-colors"
            onClick={() => onProductClick?.(productId)}
          >
            {title}
          </h3>

          {/* Action Buttons - Only for seller/admin who can create orders */}
          {canCreateOrder && (
            <div className="flex gap-1.5">
              {userRole === 'seller' && onEditOrder && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-[11px] rounded-xl border-primary/25 text-primary hover:bg-primary/10 gap-1"
                  onClick={(e) => { e.stopPropagation(); onEditOrder(); }}
                >
                  <Edit className="h-3 w-3" />
                  إنشاء طلب
                </Button>
              )}
              {userRole === 'customer' && onCreateOrder && (
                <Button
                  size="sm"
                  className="flex-1 h-8 text-[11px] rounded-xl gap-1"
                  onClick={(e) => { e.stopPropagation(); onCreateOrder(); }}
                >
                  <ShoppingCart className="h-3 w-3" />
                  طلب المنتج
                </Button>
              )}
            </div>
          )}

          {/* Timestamp */}
          <p className="text-[9px] text-muted-foreground/70 text-start">{timestamp}</p>
        </div>
      </div>
    </div>
  );
}
