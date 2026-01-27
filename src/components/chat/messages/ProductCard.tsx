import { Package, ShoppingCart, Edit } from 'lucide-react';
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
}: ProductCardProps) {
  const isSeller = userRole === 'seller';
  const isCustomer = userRole === 'customer';

  return (
    <div className={cn("flex my-1.5", isMe ? "justify-start" : "justify-end")}>
      <div className={cn(
        "w-[200px] rounded-xl overflow-hidden shadow-md border bg-card"
      )}>
        {/* Compact Header */}
        <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 border-b">
          <Package className="h-3 w-3 text-primary" />
          <span className="text-[9px] font-medium text-primary">منتج</span>
        </div>

        {/* Product Row - Horizontal Layout */}
        <div className="flex gap-2 p-2">
          {/* Small Image */}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="h-12 w-12 rounded-lg object-cover bg-muted shrink-0"
            />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-muted-foreground/40" />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-xs line-clamp-2 leading-tight">{title}</h3>
            <p className="text-sm font-bold text-primary mt-0.5">
              {price.toLocaleString()}
              <span className="text-[10px] font-normal mr-0.5">{currency}</span>
            </p>
          </div>
        </div>

        {/* Action Button - Role Based */}
        <div className="px-2 pb-2">
          {/* Seller sees "Edit Order" to create custom order from this product */}
          {isSeller && onEditOrder && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-[10px] rounded-lg border-primary/30 text-primary hover:bg-primary/10"
              onClick={onEditOrder}
            >
              <Edit className="h-3 w-3 ml-1" />
              تعديل وإنشاء طلب
            </Button>
          )}
          
          {/* Customer sees "Create Order" */}
          {isCustomer && onCreateOrder && (
            <Button
              size="sm"
              className="w-full h-7 text-[10px] rounded-lg"
              onClick={onCreateOrder}
            >
              <ShoppingCart className="h-3 w-3 ml-1" />
              إنشاء طلب
            </Button>
          )}
        </div>

        {/* Timestamp */}
        <div className="px-2 pb-1.5 text-[9px] text-muted-foreground text-left">
          {timestamp}
        </div>
      </div>
    </div>
  );
}
