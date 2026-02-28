import { Package, Truck, Clock, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface OrderTrackingCardProps {
  orderNumber: string;
  orderId?: string;
  isMe: boolean;
  timestamp: string;
}

const TRACKING_STEPS = [
  { label: 'تم الطلب', icon: Package },
  { label: 'قيد التجهيز', icon: Clock },
  { label: 'تم الشحن', icon: Truck },
];

export default function OrderTrackingCard({ orderNumber, orderId, isMe, timestamp }: OrderTrackingCardProps) {
  const navigate = useNavigate();

  return (
    <div className={cn("flex my-2", isMe ? "justify-start" : "justify-end")}>
      <div className={cn(
        "w-[280px] rounded-2xl overflow-hidden shadow-lg border",
        "bg-gradient-to-b from-card to-background"
      )}>
        {/* Header */}
        <div className="px-3 py-2.5 flex items-center justify-between border-b bg-primary/5">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Truck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="text-xs font-bold text-foreground">تتبع الطلب</span>
              <p className="text-[10px] text-muted-foreground font-mono">#{orderNumber}</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
            <Clock className="h-3 w-3 ml-1" />
            قيد المتابعة
          </Badge>
        </div>

        {/* Progress Steps */}
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between gap-1">
            {TRACKING_STEPS.map((step, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors",
                  i === 0 
                    ? "bg-primary border-primary text-primary-foreground" 
                    : "bg-muted/50 border-border text-muted-foreground"
                )}>
                  <step.icon className="h-3.5 w-3.5" />
                </div>
                <span className={cn(
                  "text-[10px] text-center leading-tight",
                  i === 0 ? "text-primary font-semibold" : "text-muted-foreground"
                )}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
          <Progress value={15} className="h-1.5" />

          <p className="text-xs text-muted-foreground text-center">
            تم استلام طلبك بنجاح وسيتم تحديث الحالة
          </p>
        </div>

        {/* Action Button */}
        <div className="px-3 pb-3">
          <Button
            size="sm"
            className="w-full h-9 text-xs rounded-xl gap-1.5"
            onClick={() => navigate('/my-orders')}
          >
            عرض تفاصيل الطلب
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Timestamp */}
        <div className="px-3 pb-2 text-center">
          <span className="text-[10px] text-muted-foreground">{timestamp}</span>
        </div>
      </div>
    </div>
  );
}
