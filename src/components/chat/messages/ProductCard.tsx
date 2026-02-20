import { Package, ShoppingCart, Edit, ExternalLink } from 'lucide-react';
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
  onCreateOrder,
  onEditOrder,
  onProductClick,
}: ProductCardProps) {
  const isSeller = userRole === 'seller';
  const isCustomer = userRole === 'customer';

  return (
    <div className={cn("flex my-2", isMe ? "justify-start" : "justify-end")}>
      <div className="w-[260px] rounded-2xl overflow-hidden border border-border/60 bg-card shadow-lg">
        {/* Product Image - hero style */}
        <div
          className="relative h-36 bg-muted cursor-pointer group"
          onClick={() => onProductClick?.(productId)}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/60">
              <Package className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          {/* Badge */}
          <div className="absolute top-2.5 start-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/90 backdrop-blur-sm">
            <Package className="h-3 w-3 text-primary-foreground" />
            <span className="text-[10px] font-bold text-primary-foreground">منتج</span>
          </div>
          {/* External link icon */}
          <button
            onClick={(e) => { e.stopPropagation(); onProductClick?.(productId); }}
            className="absolute top-2.5 end-2.5 p-1.5 rounded-full bg-black/30 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/50 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          {/* Price on image */}
          <div className="absolute bottom-2.5 start-2.5">
            <p className="text-lg font-black text-white drop-shadow-lg">
              {price.toLocaleString()}
              <span className="text-xs font-medium mr-1 opacity-80">{currency}</span>
            </p>
          </div>
        </div>

        {/* Product Info */}
        <div className="p-3 space-y-2.5">
          <h3
            className="font-bold text-sm leading-snug line-clamp-2 text-foreground cursor-pointer hover:text-primary transition-colors"
            onClick={() => onProductClick?.(productId)}
          >
            {title}
          </h3>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {isSeller && onEditOrder && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-9 text-xs rounded-xl border-primary/30 text-primary hover:bg-primary/10 gap-1.5"
                onClick={(e) => { e.stopPropagation(); onEditOrder(); }}
              >
                <Edit className="h-3.5 w-3.5" />
                تعديل وإنشاء طلب
              </Button>
            )}
            {isCustomer && onCreateOrder && (
              <Button
                size="sm"
                className="flex-1 h-9 text-xs rounded-xl gap-1.5"
                onClick={(e) => { e.stopPropagation(); onCreateOrder(); }}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                طلب المنتج
              </Button>
            )}
          </div>
        </div>

        {/* Timestamp */}
        <div className="px-3 pb-2 text-[10px] text-muted-foreground text-start">
          {timestamp}
        </div>
      </div>
    </div>
  );
}
