import { 
  Package, 
  Clock, 
  CheckCircle, 
  Truck, 
  CreditCard,
  XCircle,
  Edit,
  MessageSquare,
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

export type ChatRole = 'seller' | 'customer';

interface OrderCardProps {
  orderId: string;
  productId: string;
  productTitle: string;
  productImage?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string | null;
  status: OrderStatus;
  currency?: string;
  isMe: boolean;
  timestamp: string;
  userRole: ChatRole;
  // Actions
  onPayNow?: (orderId: string) => void;
  onTrack?: () => void;
  onConfirmReceipt?: () => void;
  onCancel?: () => void;
  onProposeChange?: () => void;
  
  onAddNotes?: () => void;
}

const STATUS_CONFIG: Record<OrderStatus, { 
  label: string; 
  color: string; 
  icon: any;
  bgColor: string;
}> = {
  created: { 
    label: 'جديد', 
    color: 'text-blue-600', 
    icon: Package,
    bgColor: 'bg-blue-500/10 border-blue-500/20',
  },
  waiting_seller_confirmation: { 
    label: 'بانتظار التأكيد', 
    color: 'text-amber-600', 
    icon: Clock,
    bgColor: 'bg-amber-500/10 border-amber-500/20',
  },
  modification_proposed: { 
    label: 'تعديل مقترح', 
    color: 'text-orange-600', 
    icon: Edit,
    bgColor: 'bg-orange-500/10 border-orange-500/20',
  },
  waiting_customer_approval: { 
    label: 'بانتظار الموافقة', 
    color: 'text-orange-600', 
    icon: Clock,
    bgColor: 'bg-orange-500/10 border-orange-500/20',
  },
  approved: { 
    label: 'تمت الموافقة', 
    color: 'text-green-600', 
    icon: CheckCircle,
    bgColor: 'bg-green-500/10 border-green-500/20',
  },
  waiting_payment: { 
    label: 'بانتظار الدفع', 
    color: 'text-purple-600', 
    icon: CreditCard,
    bgColor: 'bg-purple-500/10 border-purple-500/20',
  },
  paid: { 
    label: 'مدفوع', 
    color: 'text-green-600', 
    icon: CheckCircle,
    bgColor: 'bg-green-500/10 border-green-500/20',
  },
  shipped: { 
    label: 'تم الشحن', 
    color: 'text-indigo-600', 
    icon: Truck,
    bgColor: 'bg-indigo-500/10 border-indigo-500/20',
  },
  completed: { 
    label: 'مكتمل', 
    color: 'text-green-600', 
    icon: CheckCircle,
    bgColor: 'bg-green-500/10 border-green-500/20',
  },
  canceled: { 
    label: 'ملغي', 
    color: 'text-red-600', 
    icon: XCircle,
    bgColor: 'bg-red-500/10 border-red-500/20',
  },
};

// Define which buttons are available for each role at each status
const getAvailableActions = (status: OrderStatus, role: ChatRole) => {
  const actions: {
    payNow?: boolean;
    track?: boolean;
    confirmReceipt?: boolean;
    cancel?: boolean;
    proposeChange?: boolean;
    addNotes?: boolean;
  } = {};

  // Statuses where order is considered "paid" - merchant cannot edit
  const paidStatuses: OrderStatus[] = ['paid', 'shipped', 'completed'];
  const isPaid = paidStatuses.includes(status);

  if (role === 'customer') {
    switch (status) {
      case 'created':
      case 'approved':
        actions.cancel = true;
        break;
      case 'waiting_payment':
        actions.payNow = true;
        actions.cancel = true;
        break;
      case 'paid':
        actions.track = true;
        break;
      case 'shipped':
        actions.track = true;
        actions.confirmReceipt = true;
        break;
    }
  } else if (role === 'seller') {
    // After payment, seller can ONLY add notes
    if (isPaid) {
      actions.addNotes = true;
    } else {
      switch (status) {
        case 'created':
        case 'waiting_customer_approval':
        case 'approved':
        case 'waiting_payment':
          actions.proposeChange = true;
          actions.addNotes = true;
          break;
      }
      // Can cancel only before payment
      if (!isPaid && status !== 'canceled') {
        actions.cancel = true;
      }
    }
  }

  return actions;
};

export default function OrderCard({
  orderId,
  productId,
  productTitle,
  productImage,
  quantity,
  unitPrice,
  totalPrice,
  notes,
  status,
  currency = 'د.ع',
  isMe,
  timestamp,
  userRole,
  onPayNow,
  onTrack,
  onConfirmReceipt,
  onCancel,
  onProposeChange,
  onAddNotes,
}: OrderCardProps) {
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.created;
  const StatusIcon = statusConfig.icon;
  const availableActions = getAvailableActions(status, userRole);

  return (
    <div className={cn("flex my-2", isMe ? "justify-start" : "justify-end")}>
      <div className={cn(
        "w-[300px] rounded-2xl overflow-hidden shadow-lg border",
        "bg-gradient-to-b from-card to-background"
      )}>
        {/* Header with Status */}
        <div className={cn("px-3 py-2 flex items-center justify-between border-b", statusConfig.bgColor)}>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold">بطاقة طلب</span>
          </div>
          <Badge className={cn("text-[10px]", statusConfig.bgColor, statusConfig.color)}>
            <StatusIcon className="h-3 w-3 ml-1" />
            {statusConfig.label}
          </Badge>
        </div>

        {/* Product Info */}
        <div className="p-3 space-y-2">
          <div className="flex gap-3">
            {/* Thumbnail */}
            {productImage ? (
              <img
                src={productImage}
                alt={productTitle}
                className="h-16 w-16 rounded-lg object-cover bg-muted flex-shrink-0"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Package className="h-6 w-6 text-muted-foreground/30" />
              </div>
            )}

            {/* Details */}
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm line-clamp-2 leading-tight mb-1">
                {productTitle}
              </h4>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>الكمية: {quantity}</span>
                <span>×</span>
                <span>{unitPrice.toLocaleString()} {currency}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {notes && (
            <div className="p-2 rounded-lg bg-muted/50 border border-border">
              <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                ملاحظات
              </div>
              <p className="text-xs text-foreground line-clamp-2">{notes}</p>
            </div>
          )}

          {/* Total Price */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground">الإجمالي</span>
            <p className="text-lg font-black text-primary">
              {totalPrice.toLocaleString()}
              <span className="text-xs font-normal mr-1">{currency}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons - Role & Status Based */}
        <div className="p-3 pt-0 space-y-2">
          {/* Primary Actions Row */}
          <div className="flex gap-2">
            {availableActions.payNow && onPayNow && (
              <Button
                size="sm"
                className="flex-1 h-9 text-xs rounded-lg bg-gradient-to-b from-green-600 to-green-700"
                onClick={() => onPayNow(orderId)}
              >
                <CreditCard className="h-3.5 w-3.5 ml-1" />
                ادفع الآن
              </Button>
            )}
            
            {availableActions.track && onTrack && (
              <Button
                size="sm"
                className="flex-1 h-9 text-xs rounded-lg"
                onClick={onTrack}
              >
                <Truck className="h-3.5 w-3.5 ml-1" />
                تتبع الشحن
              </Button>
            )}
            
            {availableActions.confirmReceipt && onConfirmReceipt && (
              <Button
                size="sm"
                className="flex-1 h-9 text-xs rounded-lg bg-gradient-to-b from-primary to-accent"
                onClick={onConfirmReceipt}
              >
                <CheckCircle className="h-3.5 w-3.5 ml-1" />
                تأكيد الاستلام
              </Button>
            )}
            
            {availableActions.proposeChange && onProposeChange && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-9 text-xs rounded-lg border-primary/30 text-primary"
                onClick={onProposeChange}
              >
                <Edit className="h-3.5 w-3.5 ml-1" />
                تعديل السعر
              </Button>
            )}
          </div>

          {/* Secondary Actions Row */}
          <div className="flex gap-2">
            {availableActions.addNotes && onAddNotes && (
              <Button
                size="sm"
                variant="ghost"
                className="flex-1 h-8 text-xs"
                onClick={onAddNotes}
              >
                <MessageSquare className="h-3 w-3 ml-1" />
                إضافة ملاحظة
              </Button>
            )}
            
            
            {availableActions.cancel && onCancel && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onCancel}
              >
                <XCircle className="h-3 w-3 ml-1" />
                إلغاء
              </Button>
            )}
          </div>
        </div>

        {/* Order Reference & Timestamp */}
        <div className="px-3 pb-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="font-mono">#{orderId.slice(0, 8)}</span>
          <span>{timestamp}</span>
        </div>
      </div>
    </div>
  );
}
