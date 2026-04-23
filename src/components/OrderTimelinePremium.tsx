import { format, differenceInDays, isPast, isToday } from 'date-fns';
import { ar as arLocale, enUS } from 'date-fns/locale';
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
  Timer,
  Plane,
  Ship
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/i18n';

interface OrderTimelinePremiumProps {
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

export const OrderTimelinePremium = ({ order, isPreOrder }: OrderTimelinePremiumProps) => {
  const { t, language, isRtl } = useLanguage();
  const dateLocale = language === 'en' ? enUS : arLocale;

  const getPreOrderSteps = (): TimelineStep[] => {
    const statusOrder = ['pending', 'confirmed', 'purchased', 'arrived_warehouse', 'shipped', 'arrived_iraq', 'on_the_way', 'delivered'];
    const currentIndex = statusOrder.indexOf(order.status);

    return [
      { key: 'created', title: t('tl_step_created_title'), description: t('tl_step_created_desc'), icon: <ShoppingCart className="h-5 w-5" />, isCompleted: currentIndex >= 0, timestamp: order.created_at },
      { key: 'confirmed', title: t('tl_step_confirmed_title'), description: t('tl_step_confirmed_desc'), icon: <CreditCard className="h-5 w-5" />, isCompleted: currentIndex >= 1, timestamp: order.confirmed_at },
      { key: 'purchased', title: t('tl_step_purchased_title'), description: t('tl_step_purchased_desc'), icon: <PackageCheck className="h-5 w-5" />, isCompleted: currentIndex >= 2, timestamp: order.purchased_at },
      { key: 'arrived_warehouse', title: t('tl_step_warehouse_title'), description: t('tl_step_warehouse_desc'), icon: <Warehouse className="h-5 w-5" />, isCompleted: currentIndex >= 3, timestamp: order.arrived_warehouse_at, showImage: true },
      { key: 'shipped', title: t('tl_step_shipped_iraq_title'), description: t('tl_step_shipped_iraq_desc'), icon: <Ship className="h-5 w-5" />, isCompleted: currentIndex >= 4, timestamp: order.shipped_at },
      { key: 'arrived_iraq', title: t('tl_step_arrived_iraq_title'), description: t('tl_step_arrived_iraq_desc'), icon: <MapPin className="h-5 w-5" />, isCompleted: currentIndex >= 5, timestamp: order.arrived_iraq_at },
      { key: 'on_the_way', title: t('tl_step_on_the_way_title'), description: t('tl_step_on_the_way_desc'), icon: <Truck className="h-5 w-5" />, isCompleted: currentIndex >= 6, timestamp: order.on_the_way_at },
      { key: 'delivered', title: t('tl_step_delivered_title'), description: t('tl_step_delivered_desc'), icon: <CheckCircle2 className="h-5 w-5" />, isCompleted: currentIndex >= 7, timestamp: order.delivered_at },
    ];
  };

  const getDirectOrderSteps = (): TimelineStep[] => {
    const statusOrder = ['pending', 'confirmed', 'processing', 'on_the_way', 'delivered'];
    const currentIndex = statusOrder.indexOf(order.status);

    return [
      { key: 'created', title: t('tl_step_created_title'), description: t('tl_direct_created_desc'), icon: <ShoppingCart className="h-5 w-5" />, isCompleted: currentIndex >= 0, timestamp: order.created_at },
      { key: 'confirmed', title: t('tl_step_confirmed_title'), description: t('tl_direct_confirmed_desc'), icon: <CreditCard className="h-5 w-5" />, isCompleted: currentIndex >= 1, timestamp: order.confirmed_at },
      { key: 'processing', title: t('tl_direct_processing_title'), description: t('tl_direct_processing_desc'), icon: <PackageCheck className="h-5 w-5" />, isCompleted: currentIndex >= 2, timestamp: order.processing_at },
      { key: 'on_the_way', title: t('tl_step_on_the_way_title'), description: t('tl_step_on_the_way_desc'), icon: <Truck className="h-5 w-5" />, isCompleted: currentIndex >= 3, timestamp: order.on_the_way_at },
      { key: 'delivered', title: t('tl_step_delivered_title'), description: t('tl_direct_delivered_desc'), icon: <CheckCircle2 className="h-5 w-5" />, isCompleted: currentIndex >= 4, timestamp: order.delivered_at },
    ];
  };

  const steps = isPreOrder ? getPreOrderSteps() : getDirectOrderSteps();
  const currentStepIndex = steps.reduce((lastIndex, step, index) => step.isCompleted ? index : lastIndex, -1);
  const progressPercent = steps.length > 1 ? ((currentStepIndex + 1) / steps.length) * 100 : 0;

  const renderDaysLeft = (daysRemaining: number) => {
    if (daysRemaining === 1) return t('tl_one_day_left');
    if (daysRemaining === 2) return t('tl_two_days_left');
    if (daysRemaining <= 10) return t('tl_days_left_few', { days: daysRemaining });
    return t('tl_days_left_many', { days: daysRemaining });
  };

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-muted-foreground">
            {currentStepIndex + 1} / {steps.length}
          </span>
          <span className="text-xs font-bold text-primary">
            {Math.round(progressPercent)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted/50 overflow-hidden backdrop-blur-sm border border-border/30">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-${isRtl ? 'l' : 'r'} from-primary to-primary/60`}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="relative space-y-0">
        {/* Vertical line */}
        <div className={`absolute ${isRtl ? 'right-[19px]' : 'left-[19px]'} top-6 bottom-6 w-[2px] bg-border/40`} />
        <motion.div
          className={`absolute ${isRtl ? 'right-[19px]' : 'left-[19px]'} top-6 w-[2px] bg-gradient-to-b from-primary to-primary/40 z-[1]`}
          initial={{ height: 0 }}
          animate={{ height: `${progressPercent}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ maxHeight: 'calc(100% - 48px)' }}
        />

        {steps.map((step, index) => {
          const isCurrent = index === currentStepIndex;
          const isPastStep = step.isCompleted;

          return (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08, duration: 0.4 }}
              className="relative flex gap-4 py-3"
            >
              {/* Icon */}
              <div className={`
                relative z-[2] w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500
                ${isPastStep
                  ? 'bg-primary/15 text-primary border border-primary/30 shadow-[0_0_12px_hsl(var(--primary)/0.2)]'
                  : 'bg-muted/30 text-muted-foreground/50 border border-border/30'
                }
                ${isCurrent ? 'ring-[3px] ring-primary/20 scale-110 bg-primary/20' : ''}
              `}>
                {isPastStep ? step.icon : <Clock className="h-4 w-4" />}
              </div>

              {/* Content */}
              <div className={`
                flex-1 rounded-xl p-3 transition-all duration-300
                ${isCurrent
                  ? 'bg-primary/5 border border-primary/20 shadow-[0_4px_16px_hsl(var(--primary)/0.08)]'
                  : isPastStep
                    ? 'bg-card/40'
                    : 'opacity-50'
                }
              `}>
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className={`font-bold text-sm ${isPastStep ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.title}
                  </h4>
                  {isCurrent && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black bg-primary/15 text-primary border border-primary/20">
                      <span className={`w-1.5 h-1.5 rounded-full bg-primary ${isRtl ? 'ml-1' : 'mr-1'} animate-pulse`} />
                      {t('tl_current_label')}
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">{step.description}</p>

                {step.timestamp && isPastStep && (
                  <p className="text-[11px] text-primary/80 font-medium mt-1.5 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(step.timestamp), 'PPP - p', { locale: dateLocale })}
                  </p>
                )}

                {/* Serial number image */}
                {step.showImage && order.serial_number_image_url && isPastStep && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1.5">{t('tl_serial_image_label')}</p>
                    <img
                      src={order.serial_number_image_url}
                      alt="Serial Number"
                      className="max-w-[180px] rounded-xl border border-border/50 shadow-lg hover:scale-105 transition-transform cursor-pointer"
                      onClick={() => window.open(order.serial_number_image_url!, '_blank')}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Estimated delivery date */}
      {isPreOrder && order.estimated_delivery_date && (() => {
        const estimatedDate = new Date(order.estimated_delivery_date);
        const today = new Date();
        const daysRemaining = differenceInDays(estimatedDate, today);
        const isOverdue = isPast(estimatedDate) && !isToday(estimatedDate);
        const isDeliveryToday = isToday(estimatedDate);
        const isDelivered = order.status === 'delivered';

        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={`p-4 rounded-2xl border backdrop-blur-sm ${
              isDelivered ? 'bg-primary/5 border-primary/20'
                : isOverdue ? 'bg-destructive/5 border-destructive/20'
                : 'bg-primary/5 border-primary/15'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${
                isDelivered ? 'bg-primary/15' : isOverdue ? 'bg-destructive/15' : 'bg-primary/10'
              }`}>
                <Calendar className={`h-5 w-5 ${isOverdue && !isDelivered ? 'text-destructive' : 'text-primary'}`} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-muted-foreground mb-0.5">
                  {isDelivered ? t('tl_estimated_delivered_label') : t('tl_estimated_label')}
                </p>
                <p className={`text-base font-black ${isOverdue && !isDelivered ? 'text-destructive' : 'text-primary'}`}>
                  {format(estimatedDate, 'EEEE، d MMMM yyyy', { locale: dateLocale })}
                </p>

                {!isDelivered && (
                  <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${
                    isOverdue ? 'bg-destructive/10 text-destructive'
                      : isDeliveryToday ? 'bg-primary/15 text-primary'
                      : 'bg-primary/10 text-primary'
                  }`}>
                    <Timer className="h-3 w-3" />
                    {isOverdue ? t('tl_overdue_days', { days: Math.abs(daysRemaining) })
                      : isDeliveryToday ? t('tl_arriving_today')
                      : renderDaysLeft(daysRemaining)
                    }
                  </div>
                )}

                {isDelivered && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-primary/15 text-primary">
                    <CheckCircle2 className="h-3 w-3" />
                    {t('tl_delivered_success')}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })()}

      {/* Order type chip */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${
        isPreOrder
          ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400'
          : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
      }`}>
        {isPreOrder ? <><Clock className="h-3 w-3" /> {t('tl_chip_preorder')}</> : <><CheckCircle2 className="h-3 w-3" /> {t('tl_chip_direct')}</>}
      </div>
    </div>
  );
};
