import { memo, useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CheckCircle2, Package, Clock, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OrderSuccessAnimationProps {
  open: boolean;
  onClose: () => void;
  orderNumber?: string;
  timeUntilCutoff?: string | null; // null if past 5 PM
}

const OrderSuccessAnimation = memo(({ open, onClose, orderNumber, timeUntilCutoff }: OrderSuccessAnimationProps) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) { setStep(0); return; }
    const t1 = setTimeout(() => setStep(1), 300);
    const t2 = setTimeout(() => setStep(2), 800);
    const t3 = setTimeout(() => setStep(3), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        dir="rtl"
        className="max-w-sm mx-auto p-0 overflow-hidden border-0 bg-transparent shadow-none [&>button]:hidden"
      >
        <div className="relative rounded-2xl overflow-hidden bg-card border border-border/50 shadow-2xl">
          {/* Animated background circles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className={cn(
              "absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/10 transition-all duration-1000",
              step >= 1 ? "scale-100 opacity-100" : "scale-0 opacity-0"
            )} />
            <div className={cn(
              "absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-accent/10 transition-all duration-1000 delay-300",
              step >= 2 ? "scale-100 opacity-100" : "scale-0 opacity-0"
            )} />
          </div>

          <div className="relative z-10 p-8 flex flex-col items-center text-center space-y-5">
            {/* Animated checkmark */}
            <div className={cn(
              "relative transition-all duration-700 ease-out",
              step >= 1 ? "scale-100 opacity-100" : "scale-0 opacity-0"
            )}>
              {/* Outer ring pulse */}
              <div className={cn(
                "absolute inset-0 rounded-full bg-primary/20 transition-all duration-1000",
                step >= 2 ? "scale-[1.8] opacity-0" : "scale-100 opacity-100"
              )} />
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
                <CheckCircle2 className="h-10 w-10 text-primary-foreground" strokeWidth={2.5} />
              </div>
            </div>

            {/* Title */}
            <div className={cn(
              "space-y-2 transition-all duration-500",
              step >= 2 ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            )}>
              <h3 className="text-xl font-black text-foreground">تم تأكيد طلبك بنجاح! 🎉</h3>
              {orderNumber && (
                <p className="text-sm text-muted-foreground">
                  رقم الطلب: <span className="font-bold text-primary">{orderNumber}</span>
                </p>
              )}
            </div>

            {/* Delivery info */}
            <div className={cn(
              "w-full space-y-3 transition-all duration-500 delay-200",
              step >= 3 ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            )}>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
                <Truck className="h-5 w-5 text-primary shrink-0" />
                <p className="text-xs text-foreground text-right leading-relaxed">
                  سيتم التوصيل خلال <span className="font-bold text-primary">24-48 ساعة</span> - الدفع عند الاستلام
                </p>
              </div>

              {/* Combined delivery notice */}
              {timeUntilCutoff && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-accent/10 border border-accent/20">
                  <Clock className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                  <div className="text-right">
                    <p className="text-xs font-bold text-foreground leading-relaxed">
                      لديك <span className="text-accent">{timeUntilCutoff}</span> لإضافة منتجات أخرى
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                      اطلب منتجات بيع مباشر إضافية قبل الساعة 5:00 مساءً وسيتم توصيلها معاً في شحنة واحدة مجاناً! 🚚
                    </p>
                  </div>
                </div>
              )}

              {!timeUntilCutoff && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
                  <Package className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-[11px] text-muted-foreground text-right leading-relaxed">
                    تجاوزت الساعة 5:00 مساءً — سيتم شحن هذا الطلب بشكل منفصل.
                  </p>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className={cn(
              "w-full pt-2 transition-all duration-500 delay-500",
              step >= 3 ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            )}>
              <Button
                onClick={onClose}
                className="w-full h-11 font-bold bg-gradient-to-l from-primary to-accent text-primary-foreground hover:opacity-90"
              >
                متابعة التسوق
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

OrderSuccessAnimation.displayName = 'OrderSuccessAnimation';
export default OrderSuccessAnimation;
