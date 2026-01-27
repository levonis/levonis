import { 
  AlertCircle, 
  CheckCircle, 
  X, 
  DollarSign,
  FileText,
  Truck,
  ArrowLeftRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ChangeType = 'price_change' | 'notes_change' | 'shipping_change';

interface ConfirmationCardProps {
  orderId: string;
  changeType: ChangeType;
  oldValue: string;
  newValue: string;
  sellerNote?: string | null;
  isMe: boolean;
  timestamp: string;
  isPending?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}

const CHANGE_CONFIG: Record<ChangeType, { 
  label: string; 
  icon: any;
  color: string;
}> = {
  price_change: { 
    label: 'تعديل السعر', 
    icon: DollarSign,
    color: 'text-orange-500'
  },
  notes_change: { 
    label: 'تعديل الملاحظات', 
    icon: FileText,
    color: 'text-blue-500'
  },
  shipping_change: { 
    label: 'تعديل الشحن', 
    icon: Truck,
    color: 'text-purple-500'
  },
};

export default function ConfirmationCard({
  orderId,
  changeType,
  oldValue,
  newValue,
  sellerNote,
  isMe,
  timestamp,
  isPending = true,
  onApprove,
  onReject,
}: ConfirmationCardProps) {
  const changeConfig = CHANGE_CONFIG[changeType];
  const ChangeIcon = changeConfig.icon;

  return (
    <div className={cn("flex my-2", isMe ? "justify-start" : "justify-end")}>
      <div className={cn(
        "w-[300px] rounded-2xl overflow-hidden shadow-lg border-2",
        isPending ? "border-orange-500/50" : "border-border",
        "bg-gradient-to-b from-card to-background"
      )}>
        {/* Header */}
        <div className="px-3 py-2 bg-orange-500/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-bold text-orange-600">
              طلب تعديل
            </span>
          </div>
          <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-600">
            {changeConfig.label}
          </Badge>
        </div>

        {/* Change Details */}
        <div className="p-3 space-y-3">
          {/* Order Reference */}
          <div className="text-xs text-muted-foreground">
            الطلب: <span className="font-mono">#{orderId.slice(0, 8)}</span>
          </div>

          {/* Values Comparison */}
          <div className="flex items-center gap-2">
            {/* Old Value */}
            <div className="flex-1 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="text-[10px] text-red-500 mb-1">القيمة السابقة</div>
              <div className="text-sm font-bold text-red-600 line-through">
                {oldValue}
              </div>
            </div>

            {/* Arrow */}
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground shrink-0" />

            {/* New Value */}
            <div className="flex-1 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-[10px] text-green-500 mb-1">القيمة الجديدة</div>
              <div className="text-sm font-bold text-green-600">
                {newValue}
              </div>
            </div>
          </div>

          {/* Seller Note */}
          {sellerNote && (
            <div className="p-2 rounded-lg bg-muted/50 border border-border">
              <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                <ChangeIcon className={cn("h-3 w-3", changeConfig.color)} />
                ملاحظة البائع
              </div>
              <p className="text-xs text-foreground">{sellerNote}</p>
            </div>
          )}
        </div>

        {/* Action Buttons - Only show if pending and not the sender */}
        {isPending && !isMe && (
          <div className="p-3 pt-0 flex gap-2">
            <Button
              size="sm"
              className="flex-1 h-9 text-xs rounded-lg bg-gradient-to-b from-green-600 to-green-700"
              onClick={onApprove}
            >
              <CheckCircle className="h-3.5 w-3.5 ml-1" />
              موافقة
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-9 text-xs rounded-lg border-red-500/30 text-red-500 hover:bg-red-500/10"
              onClick={onReject}
            >
              <X className="h-3.5 w-3.5 ml-1" />
              رفض
            </Button>
          </div>
        )}

        {/* Status Badge - If already processed */}
        {!isPending && (
          <div className="px-3 pb-3">
            <Badge className={cn(
              "w-full justify-center py-1.5",
              isMe ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
            )}>
              {isMe ? "✓ تمت الموافقة" : "✗ تم الرفض"}
            </Badge>
          </div>
        )}

        {/* Timestamp */}
        <div className="px-3 pb-2 text-[10px] text-muted-foreground text-left">
          {timestamp}
        </div>
      </div>
    </div>
  );
}
