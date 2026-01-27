import { 
  Package, 
  CreditCard, 
  Truck, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  MapPin,
  MessageSquare,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type OrderStatus = 
  | 'created'
  | 'waiting_seller_confirmation'
  | 'modification_proposed'
  | 'waiting_customer_approval'
  | 'approved'
  | 'waiting_payment'
  | 'paid'
  | 'shipped'
  | 'completed'
  | 'canceled';

interface OrderCardProps {
  orderId: string;
  productId: string;
  productTitle: string;
  productThumbnail?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency?: string;
  notes?: string | null;
  shippingAddress?: string | null;
  status: OrderStatus;
  isMe: boolean;
  timestamp: string;
  isMerchant?: boolean;
  onPay?: () => void;
  onConfirm?: () => void;
  onTrack?: () => void;
  onViewDetails?: () => void;
  onCancel?: () => void;
}

const STATUS_CONFIG: Record<OrderStatus, { 
  label: string; 
  color: string; 
  icon: any;
  bgColor: string;
}> = {
  created: { 
    label: 'تم الإنشاء', 
    color: 'text-blue-500', 
    icon: Package,
    bgColor: 'bg-blue-500/10'
  },
  waiting_seller_confirmation: { 
    label: 'بانتظار التاجر', 
    color: 'text-amber-500', 
    icon: Clock,
    bgColor: 'bg-amber-500/10'
  },
  modification_proposed: { 
    label: 'تعديل مقترح', 
    color: 'text-orange-500', 
    icon: AlertCircle,
    bgColor: 'bg-orange-500/10'
  },
  waiting_customer_approval: { 
    label: 'بانتظار الموافقة', 
    color: 'text-amber-500', 
    icon: Clock,
    bgColor: 'bg-amber-500/10'
  },
  approved: { 
    label: 'تمت الموافقة', 
    color: 'text-green-500', 
    icon: CheckCircle,
    bgColor: 'bg-green-500/10'
  },
  waiting_payment: { 
    label: 'بانتظار الدفع', 
    color: 'text-purple-500', 
    icon: CreditCard,
    bgColor: 'bg-purple-500/10'
  },
  paid: { 
    label: 'تم الدفع', 
    color: 'text-emerald-500', 
    icon: CheckCircle,
    bgColor: 'bg-emerald-500/10'
  },
  shipped: { 
    label: 'تم الشحن', 
    color: 'text-cyan-500', 
    icon: Truck,
    bgColor: 'bg-cyan-500/10'
  },
  completed: { 
    label: 'مكتمل', 
    color: 'text-green-600', 
    icon: CheckCircle,
    bgColor: 'bg-green-500/10'
  },
  canceled: { 
    label: 'ملغي', 
    color: 'text-red-500', 
    icon: AlertCircle,
    bgColor: 'bg-red-500/10'
  },
};

export default function OrderCard({
  orderId,
  productId,
  productTitle,
  productThumbnail,
  quantity,
  unitPrice,
  totalPrice,
  currency = 'د.ع',
  notes,
  shippingAddress,
  status,
  isMe,
  timestamp,
  isMerchant = false,
  onPay,
  onConfirm,
  onTrack,
  onViewDetails,
  onCancel,
}: OrderCardProps) {
  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;

  // Determine which actions to show based on status
  const showPayButton = status === 'waiting_payment' && !isMerchant;
  const showConfirmButton = status === 'shipped' && !isMerchant;
  const showTrackButton = ['paid', 'shipped'].includes(status);
  const showCancelButton = ['created', 'waiting_seller_confirmation'].includes(status) && !isMerchant;

  return (
    <div className={cn("flex my-2", isMe ? "justify-start" : "justify-end")}>
      <div className={cn(
        "w-[300px] rounded-2xl overflow-hidden shadow-lg border",
        "bg-gradient-to-b from-card to-background"
      )}>
        {/* Header */}
        <div className={cn("px-3 py-2 flex items-center justify-between", statusConfig.bgColor)}>
          <div className="flex items-center gap-2">
            <StatusIcon className={cn("h-4 w-4", statusConfig.color)} />
            <span className={cn("text-xs font-bold", statusConfig.color)}>
              {statusConfig.label}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            #{orderId.slice(0, 8)}
          </span>
        </div>

        {/* Product Info */}
        <div className="p-3 flex gap-3 border-b border-border/50">
          {productThumbnail ? (
            <img
              src={productThumbnail}
              alt={productTitle}
              className="h-16 w-16 rounded-lg object-cover bg-muted"
            />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
              <Package className="h-6 w-6 text-muted-foreground/30" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm line-clamp-2 leading-snug mb-1">
              {productTitle}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>الكمية: {quantity}</span>
              <span>•</span>
              <span>{unitPrice.toLocaleString()} {currency}</span>
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div className="p-3 space-y-2">
          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">الإجمالي</span>
            <span className="text-lg font-black text-primary">
              {totalPrice.toLocaleString()}
              <span className="text-xs font-normal mr-1">{currency}</span>
            </span>
          </div>

          {/* Notes */}
          {notes && (
            <div className="p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <span className="font-medium">ملاحظات:</span> {notes}
            </div>
          )}

          {/* Shipping Address */}
          {shippingAddress && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{shippingAddress}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-3 pt-0 flex flex-wrap gap-2">
          {showPayButton && onPay && (
            <Button
              size="sm"
              className="flex-1 h-9 text-xs rounded-lg bg-gradient-to-b from-green-600 to-green-700"
              onClick={onPay}
            >
              <CreditCard className="h-3.5 w-3.5 ml-1" />
              الدفع الآن
            </Button>
          )}

          {showConfirmButton && onConfirm && (
            <Button
              size="sm"
              className="flex-1 h-9 text-xs rounded-lg bg-gradient-to-b from-primary to-accent"
              onClick={onConfirm}
            >
              <CheckCircle className="h-3.5 w-3.5 ml-1" />
              تأكيد الاستلام
            </Button>
          )}

          {showTrackButton && onTrack && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-9 text-xs rounded-lg"
              onClick={onTrack}
            >
              <Truck className="h-3.5 w-3.5 ml-1" />
              تتبع
            </Button>
          )}

          {onViewDetails && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-9 text-xs rounded-lg"
              onClick={onViewDetails}
            >
              <Eye className="h-3.5 w-3.5 ml-1" />
              التفاصيل
            </Button>
          )}

          {showCancelButton && onCancel && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
              onClick={onCancel}
            >
              إلغاء
            </Button>
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
