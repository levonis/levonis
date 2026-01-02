import { CheckCircle, Clock, Package, Truck, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface ShipmentRequest {
  id: string;
  status: string;
  tracking_number?: string | null;
  created_at: string;
  shipped_at?: string | null;
  delivered_at?: string | null;
}

interface ShipmentTrackingTimelineProps {
  shipmentRequest?: ShipmentRequest | null;
}

const statusSteps = [
  { key: 'pending', label: 'تم تسجيل الطلب', icon: Clock },
  { key: 'processing', label: 'قيد المعالجة', icon: Package },
  { key: 'shipped', label: 'تم الشحن', icon: Truck },
  { key: 'delivered', label: 'تم التوصيل', icon: MapPin },
];

const getStepIndex = (status: string) => {
  switch (status) {
    case 'pending': return 0;
    case 'processing': return 1;
    case 'shipped': return 2;
    case 'delivered': return 3;
    default: return 0;
  }
};

export default function ShipmentTrackingTimeline({ shipmentRequest }: ShipmentTrackingTimelineProps) {
  if (!shipmentRequest) {
    return (
      <div className="text-center text-sm text-muted-foreground py-3">
        لا يوجد طلب شحن مسجل
      </div>
    );
  }

  const currentStep = getStepIndex(shipmentRequest.status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">تتبع الشحنة</h4>
        {shipmentRequest.tracking_number && (
          <Badge variant="outline" className="text-xs gap-1">
            <Package className="h-3 w-3" />
            رقم التتبع: {shipmentRequest.tracking_number}
          </Badge>
        )}
      </div>

      <div className="relative">
        {/* Progress Line */}
        <div className="absolute top-5 right-5 w-[calc(100%-40px)] h-0.5 bg-muted">
          <div 
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${(currentStep / (statusSteps.length - 1)) * 100}%` }}
          />
        </div>

        {/* Steps */}
        <div className="flex justify-between relative">
          {statusSteps.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = index <= currentStep;
            const isCurrent = index === currentStep;
            
            let timestamp: string | null = null;
            if (index === 0 && shipmentRequest.created_at) {
              timestamp = format(new Date(shipmentRequest.created_at), 'dd MMM HH:mm', { locale: ar });
            } else if (index === 2 && shipmentRequest.shipped_at) {
              timestamp = format(new Date(shipmentRequest.shipped_at), 'dd MMM HH:mm', { locale: ar });
            } else if (index === 3 && shipmentRequest.delivered_at) {
              timestamp = format(new Date(shipmentRequest.delivered_at), 'dd MMM HH:mm', { locale: ar });
            }

            return (
              <div key={step.key} className="flex flex-col items-center z-10">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center transition-all
                    ${isCompleted 
                      ? isCurrent 
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' 
                        : 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                    }
                  `}
                >
                  {isCompleted && !isCurrent ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <StepIcon className="h-5 w-5" />
                  )}
                </div>
                <span className={`text-xs mt-2 text-center ${isCompleted ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
                {timestamp && (
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {timestamp}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
