import { format, differenceInDays, isPast, isToday } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  ShoppingCart, 
  Package, 
  Warehouse, 
  Truck, 
  MapPin, 
  CheckCircle2, 
  Clock,
  CreditCard,
  PackageCheck,
  Calendar,
  Timer
} from 'lucide-react';

interface OrderTimelineProps {
  order: {
    status: string;
    created_at: string;
    confirmed_at?: string | null;
    processing_at?: string | null;
    purchased_at?: string | null;
    arrived_warehouse_at?: string | null;
    shipped_at?: string | null;
    arrived_iraq_at?: string | null;
    on_the_way_at?: string | null;
    delivered_at?: string | null;
    cancelled_at?: string | null;
    serial_number_image_url?: string | null;
    estimated_delivery_date?: string | null;
  };
  isPreOrder: boolean;
}

interface TimelineStep {
  key: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  isCompleted: boolean;
  timestamp?: string | null;
  showImage?: boolean;
}

export const OrderTimeline = ({ order, isPreOrder }: OrderTimelineProps) => {
  const getPreOrderSteps = (): TimelineStep[] => {
    const statusOrder = ['pending', 'confirmed', 'purchased', 'arrived_warehouse', 'shipped', 'arrived_iraq', 'on_the_way', 'delivered'];
    const currentIndex = statusOrder.indexOf(order.status);
    
    return [
      {
        key: 'created',
        title: 'تم إنشاء الطلب',
        description: 'تم استلام طلبك بنجاح وجاري مراجعته',
        icon: <ShoppingCart className="h-4 w-4" />,
        isCompleted: currentIndex >= 0,
        timestamp: order.created_at,
      },
      {
        key: 'confirmed',
        title: 'تم تأكيد الطلب',
        description: 'تم تأكيد طلبك وجاري طلب المنتج من المورد',
        icon: <CreditCard className="h-4 w-4" />,
        isCompleted: currentIndex >= 1,
        timestamp: order.confirmed_at,
      },
      {
        key: 'purchased',
        title: 'تم الشراء',
        description: 'تم شراء المنتج من المورد وجاري الشحن إلى مخزننا',
        icon: <PackageCheck className="h-4 w-4" />,
        isCompleted: currentIndex >= 2,
        timestamp: order.purchased_at,
      },
      {
        key: 'arrived_warehouse',
        title: 'وصل إلى المخزن',
        description: 'وصل المنتج إلى مخزننا وجاري التجهيز للشحن',
        icon: <Warehouse className="h-4 w-4" />,
        isCompleted: currentIndex >= 3,
        timestamp: order.arrived_warehouse_at,
        showImage: true,
      },
      {
        key: 'shipped_to_iraq',
        title: 'تم الشحن إلى العراق',
        description: 'تم شحن طلبك وفي الطريق إلى العراق',
        icon: <Truck className="h-4 w-4" />,
        isCompleted: currentIndex >= 4,
        timestamp: order.shipped_at,
      },
      {
        key: 'arrived_iraq',
        title: 'وصل إلى العراق',
        description: 'وصلت الشحنة إلى العراق وجاري التوصيل',
        icon: <MapPin className="h-4 w-4" />,
        isCompleted: currentIndex >= 5,
        timestamp: order.arrived_iraq_at,
      },
      {
        key: 'on_the_way',
        title: 'في الطريق إليك',
        description: 'الشحنة في الطريق إلى عنوانك',
        icon: <Truck className="h-4 w-4" />,
        isCompleted: currentIndex >= 6,
        timestamp: order.on_the_way_at,
      },
      {
        key: 'delivered',
        title: 'تم التوصيل',
        description: 'تم توصيل طلبك بنجاح',
        icon: <CheckCircle2 className="h-4 w-4" />,
        isCompleted: currentIndex >= 7,
        timestamp: order.delivered_at,
      },
    ];
  };

  const getDirectOrderSteps = (): TimelineStep[] => {
    const statusOrder = ['pending', 'confirmed', 'processing', 'on_the_way', 'delivered'];
    const currentIndex = statusOrder.indexOf(order.status);
    
    return [
      {
        key: 'created',
        title: 'تم إنشاء الطلب',
        description: 'تم استلام طلبك وجاري مراجعته',
        icon: <ShoppingCart className="h-4 w-4" />,
        isCompleted: currentIndex >= 0,
        timestamp: order.created_at,
      },
      {
        key: 'confirmed',
        title: 'تم تأكيد الطلب',
        description: 'تم تأكيد طلبك وجاري تجهيزه',
        icon: <CreditCard className="h-4 w-4" />,
        isCompleted: currentIndex >= 1,
        timestamp: order.confirmed_at,
      },
      {
        key: 'processing',
        title: 'قيد التجهيز',
        description: 'جاري تجهيز وتغليف طلبك',
        icon: <PackageCheck className="h-4 w-4" />,
        isCompleted: currentIndex >= 2,
        timestamp: order.processing_at,
      },
      {
        key: 'on_the_way',
        title: 'في الطريق إليك',
        description: 'الشحنة في الطريق إلى عنوانك',
        icon: <Truck className="h-4 w-4" />,
        isCompleted: currentIndex >= 3,
        timestamp: order.on_the_way_at,
      },
      {
        key: 'delivered',
        title: 'تم التوصيل',
        description: 'تم توصيل طلبك بنجاح',
        icon: <CheckCircle2 className="h-4 w-4" />,
        isCompleted: currentIndex >= 4,
        timestamp: order.delivered_at,
      },
    ];
  };

  const steps = isPreOrder ? getPreOrderSteps() : getDirectOrderSteps();

  // Find current step (last completed step)
  const currentStepIndex = steps.reduce((lastIndex, step, index) => {
    return step.isCompleted ? index : lastIndex;
  }, -1);

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute right-4 top-4 bottom-4 w-0.5 bg-border"></div>
      
      <div className="space-y-6">
        {steps.map((step, index) => {
          const isCurrent = index === currentStepIndex;
          const isPastStep = step.isCompleted;
          
          return (
            <div key={step.key} className="relative flex gap-4 pr-10">
              {/* Icon circle */}
              <div 
                className={`absolute right-0 w-8 h-8 rounded-full border-2 flex items-center justify-center bg-background transition-all duration-300 ${
                  isPastStep 
                    ? 'border-primary text-primary' 
                    : 'border-border text-muted-foreground'
                } ${isCurrent ? 'ring-4 ring-primary/20 scale-110' : ''}`}
              >
                {isPastStep ? step.icon : <Clock className="h-4 w-4" />}
              </div>
              
              {/* Content */}
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2">
                  <h4 className={`font-bold ${isPastStep ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.title}
                  </h4>
                  {isCurrent && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary animate-pulse">
                      الحالي
                    </span>
                  )}
                </div>
                
                <p className={`text-sm mt-0.5 ${isPastStep ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                  {step.description}
                </p>
                
                {step.timestamp && isPastStep && (
                  <p className="text-xs text-primary font-medium mt-1">
                    {format(new Date(step.timestamp), 'PPP - p', { locale: ar })}
                  </p>
                )}
                
                {/* Serial number image for warehouse step */}
                {step.showImage && order.serial_number_image_url && isPastStep && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1">صورة الرقم التسلسلي:</p>
                    <img 
                      src={order.serial_number_image_url} 
                      alt="Serial Number" 
                      className="max-w-[200px] rounded-lg border border-border/50 shadow-sm hover:scale-105 transition-transform cursor-pointer"
                      onClick={() => window.open(order.serial_number_image_url!, '_blank')}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Estimated delivery date for pre-orders - always show if set */}
      {isPreOrder && order.estimated_delivery_date && (() => {
        const estimatedDate = new Date(order.estimated_delivery_date);
        const today = new Date();
        const daysRemaining = differenceInDays(estimatedDate, today);
        const isOverdue = isPast(estimatedDate) && !isToday(estimatedDate);
        const isDeliveryToday = isToday(estimatedDate);
        const isDelivered = order.status === 'delivered';
        
        return (
          <div className="mt-6 pt-4 border-t border-border/50">
            <div className={`p-4 rounded-xl border ${
              isDelivered
                ? 'bg-card border-primary/30'
                : isOverdue 
                  ? 'bg-destructive/10 border-destructive/30' 
                  : isDeliveryToday 
                    ? 'bg-card border-primary/30'
                    : 'bg-card border-primary/20'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  isDelivered
                    ? 'bg-primary/20'
                    : isOverdue 
                      ? 'bg-destructive/20' 
                      : isDeliveryToday 
                        ? 'bg-primary/20'
                        : 'bg-primary/10'
                }`}>
                  <Calendar className={`h-5 w-5 ${
                    isDelivered
                      ? 'text-primary'
                      : isOverdue 
                        ? 'text-destructive' 
                        : isDeliveryToday 
                          ? 'text-primary'
                          : 'text-primary'
                  }`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground mb-1">
                    {isDelivered ? 'تاريخ التوصيل المتوقع (تم التوصيل)' : 'التاريخ المتوقع للوصول'}
                  </p>
                  <p className={`text-lg font-bold ${
                    isDelivered
                      ? 'text-primary'
                      : isOverdue 
                        ? 'text-destructive' 
                        : isDeliveryToday 
                          ? 'text-primary'
                          : 'text-primary'
                  }`}>
                    {format(estimatedDate, 'EEEE، d MMMM yyyy', { locale: ar })}
                  </p>
                  
                  {/* Remaining days indicator - hide when delivered */}
                  {!isDelivered && (
                    <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      isOverdue 
                        ? 'bg-destructive/20 text-destructive' 
                        : isDeliveryToday 
                          ? 'bg-primary/20 text-primary'
                          : daysRemaining <= 3
                            ? 'bg-accent/20 text-accent'
                            : 'bg-primary/10 text-primary'
                    }`}>
                      <Timer className="h-3 w-3" />
                      {isOverdue ? (
                        <span>متأخر بـ {Math.abs(daysRemaining)} يوم</span>
                      ) : isDeliveryToday ? (
                        <span>متوقع الوصول اليوم!</span>
                      ) : daysRemaining === 1 ? (
                        <span>متبقي يوم واحد</span>
                      ) : daysRemaining === 2 ? (
                        <span>متبقي يومان</span>
                      ) : daysRemaining <= 10 ? (
                        <span>متبقي {daysRemaining} أيام</span>
                      ) : (
                        <span>متبقي {daysRemaining} يوم</span>
                      )}
                    </div>
                  )}
                  
                  {/* Show delivered badge */}
                  {isDelivered && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/20 text-primary">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>تم التوصيل بنجاح</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      
      {/* Order type indicator */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
          isPreOrder 
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        }`}>
          {isPreOrder ? (
            <>
              <Clock className="h-3 w-3" />
              طلب مسبق (Pre-Order)
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3 w-3" />
              متوفر للشراء المباشر
            </>
          )}
        </div>
      </div>
    </div>
  );
};
