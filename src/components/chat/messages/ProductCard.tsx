import { Package, ShoppingCart, MessageSquare, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  productId: string;
  storeId: string;
  imageUrl?: string | null;
  title: string;
  price: number;
  currency?: string;
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';
  isMe: boolean;
  timestamp: string;
  onSendProduct?: () => void;
  onCreateOrder?: () => void;
  onViewProduct?: () => void;
}

const STOCK_LABELS: Record<string, { label: string; color: string }> = {
  in_stock: { label: 'متوفر', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  low_stock: { label: 'كمية محدودة', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  out_of_stock: { label: 'غير متوفر', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

export default function ProductCard({
  productId,
  storeId,
  imageUrl,
  title,
  price,
  currency = 'د.ع',
  stockStatus = 'in_stock',
  isMe,
  timestamp,
  onSendProduct,
  onCreateOrder,
  onViewProduct,
}: ProductCardProps) {
  const stock = STOCK_LABELS[stockStatus];

  return (
    <div className={cn("flex my-2", isMe ? "justify-start" : "justify-end")}>
      <div className={cn(
        "w-[280px] rounded-2xl overflow-hidden shadow-lg border",
        "bg-gradient-to-b from-card to-background"
      )}>
        {/* Product Image */}
        {imageUrl ? (
          <div className="aspect-[4/3] bg-muted relative overflow-hidden">
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
            {/* Stock Badge */}
            <Badge className={cn("absolute top-2 right-2 text-[10px]", stock.color)}>
              {stock.label}
            </Badge>
          </div>
        ) : (
          <div className="aspect-[4/3] bg-muted flex items-center justify-center">
            <Package className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Product Info */}
        <div className="p-3 space-y-2">
          {/* Header */}
          <div className="flex items-center gap-1.5 text-primary">
            <Package className="h-3.5 w-3.5" />
            <span className="text-[10px] font-medium">بطاقة منتج</span>
          </div>

          {/* Title */}
          <h3 className="font-bold text-sm line-clamp-2 leading-snug">{title}</h3>

          {/* Price */}
          <div className="flex items-center justify-between">
            <p className="text-lg font-black text-primary">
              {price.toLocaleString()}
              <span className="text-xs font-normal mr-1">{currency}</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            {onSendProduct && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs rounded-lg"
                onClick={onSendProduct}
              >
                <MessageSquare className="h-3 w-3 ml-1" />
                إرسال
              </Button>
            )}
            {onCreateOrder && (
              <Button
                size="sm"
                className="flex-1 h-8 text-xs rounded-lg bg-gradient-to-b from-primary to-accent"
                onClick={onCreateOrder}
              >
                <ShoppingCart className="h-3 w-3 ml-1" />
                طلب
              </Button>
            )}
          </div>

          {/* View Product Link */}
          {onViewProduct && (
            <button
              onClick={onViewProduct}
              className="w-full text-center text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1 pt-1"
            >
              <ExternalLink className="h-3 w-3" />
              عرض المنتج
            </button>
          )}
        </div>

        {/* Timestamp */}
        <div className="px-3 pb-2 text-[10px] text-muted-foreground text-left">
          {timestamp}
        </div>
      </div>
    </div>
  );
}
