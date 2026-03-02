import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { MapPin, Phone, Clock, FileText, Truck, CheckCircle2, Loader2, Package, Zap, Info, Wallet } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

interface DirectSaleCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: { notes: string; useWallet: boolean; walletDeduction: number }) => Promise<void>;
  address: {
    full_name: string;
    phone_number: string;
    governorate: string;
    area: string;
    neighborhood?: string;
    nearest_landmark: string;
    additional_notes?: string;
  } | null;
  totalAmount: number;
  deliveryFee: number;
  itemCount: number;
  isProcessing: boolean;
  walletBalance: number;
  hasActiveDirectOrders: boolean;
}

const DirectSaleCheckoutDialog = ({
  open,
  onOpenChange,
  onConfirm,
  address,
  totalAmount,
  deliveryFee,
  itemCount,
  isProcessing,
  walletBalance,
  hasActiveDirectOrders,
}: DirectSaleCheckoutDialogProps) => {
  const [notes, setNotes] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [canConfirm, setCanConfirm] = useState(false);
  const [useWallet, setUseWallet] = useState(false);

  // Calculate time until 5 PM cutoff
  const now = new Date();
  const cutoff = new Date();
  cutoff.setHours(17, 0, 0, 0);
  const isBeforeCutoff = now < cutoff;
  const msUntilCutoff = isBeforeCutoff ? cutoff.getTime() - now.getTime() : 0;
  const hoursLeft = Math.floor(msUntilCutoff / 3600000);
  const minutesLeft = Math.floor((msUntilCutoff % 3600000) / 60000);
  const timeLeftText = isBeforeCutoff ? `${hoursLeft} ساعة و ${minutesLeft} دقيقة` : null;

  // Show shipping hint only if user has active direct orders
  const showAddMoreHint = hasActiveDirectOrders && isBeforeCutoff;
  const showSeparateShipmentWarning = hasActiveDirectOrders && !isBeforeCutoff;

  useEffect(() => {
    if (!open) {
      setCountdown(5);
      setCanConfirm(false);
      setNotes('');
      setUseWallet(false);
      return;
    }

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanConfirm(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open]);

  const grandTotal = totalAmount + deliveryFee;
  const walletDeduction = useWallet ? Math.min(walletBalance, grandTotal) : 0;
  const codAmount = grandTotal - walletDeduction;

  const handleConfirm = useCallback(async () => {
    if (!canConfirm || isProcessing) return;
    await onConfirm({ notes, useWallet, walletDeduction });
  }, [canConfirm, isProcessing, notes, onConfirm, useWallet, walletDeduction]);

  const progressValue = ((5 - countdown) / 5) * 100;
  const estimatedTime = address?.governorate?.includes('بغداد') ? '1-3 أيام' : '3-5 أيام';

  const glassCard = "rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        dir="rtl" 
        className="max-w-md mx-auto p-0 overflow-hidden max-h-[90vh] overflow-y-auto border-primary/20 shadow-[0_8px_40px_hsl(var(--primary)/0.15),0_0_80px_hsl(var(--primary)/0.05)]"
      >
        {/* Header with glass gradient */}
        <div className="relative p-6 pb-4">
          {/* Subtle glow behind header */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-transparent to-transparent pointer-events-none" />
          
          <DialogHeader className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shadow-[0_0_15px_hsl(var(--primary)/0.2)]">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle className="text-xl font-black text-foreground">
                تأكيد طلب البيع المباشر
              </DialogTitle>
            </div>
            <Badge variant="outline" className="w-fit border-primary/30 text-primary bg-primary/10 backdrop-blur-sm">
              <Package className="h-3 w-3 ml-1" />
              {walletDeduction >= grandTotal ? 'الدفع من المحفظة' : walletDeduction > 0 ? 'دفع مختلط' : 'الدفع عند الاستلام'}
            </Badge>
          </DialogHeader>

          {/* Delivery hints - only show if user has active orders */}
          {(showAddMoreHint || showSeparateShipmentWarning) && (
            <div className="mt-3 space-y-2 relative z-10">
              {showAddMoreHint && (
                <div className={`flex items-start gap-2 rounded-xl p-3 border border-accent/20 bg-accent/10 backdrop-blur-sm`}>
                  <Info className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-foreground leading-relaxed">
                      لديك <span className="text-accent">{timeLeftText}</span> لإضافة منتجات أخرى
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                      اطلب منتجات بيع مباشر إضافية قبل <span className="font-bold">5:00 مساءً</span> وسيتم توصيلها في شحنة واحدة مجاناً! 🚚
                    </p>
                  </div>
                </div>
              )}
              {showSeparateShipmentWarning && (
                <div className={`flex items-start gap-2 rounded-xl p-3 border border-white/10 bg-white/5 backdrop-blur-sm`}>
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    تجاوزت الساعة 5:00 مساءً — سيتم شحن هذا الطلب بشكل منفصل عن الطلبات السابقة.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Fast delivery badge */}
          <div className={`mt-3 flex items-center gap-2 rounded-xl p-3 border border-primary/15 bg-primary/8 backdrop-blur-sm relative z-10`}>
            <Zap className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">
              توصيل سريع خلال <span className="font-black text-primary">24-48 ساعة</span>
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Address Info */}
          {address && (
            <div className={`${glassCard} p-4 space-y-3`}>
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                عنوان التوصيل
              </div>
              <div className="text-sm text-muted-foreground space-y-1 pr-6">
                <p className="font-medium text-foreground">{address.full_name}</p>
                <p>{address.governorate} - {address.area}</p>
                {address.neighborhood && <p>{address.neighborhood}</p>}
                <p>{address.nearest_landmark}</p>
              </div>

              <Separator className="bg-white/10" />

              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">رقم الهاتف:</span>
                <span className="font-bold text-foreground" dir="ltr">{address.phone_number}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">الوصول المتوقع:</span>
                <span className="font-bold text-foreground">{estimatedTime}</span>
              </div>
            </div>
          )}

          {/* Wallet Balance Option */}
          {walletBalance > 0 && (
            <div className={`rounded-xl border p-4 space-y-3 transition-all backdrop-blur-sm ${useWallet ? 'border-primary/30 bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.1)]' : 'border-white/10 bg-white/5'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">استخدام رصيد المحفظة</span>
                </div>
                <Switch
                  checked={useWallet}
                  onCheckedChange={setUseWallet}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">رصيد المحفظة</span>
                <span className="font-bold text-primary">{formatPrice(walletBalance)} د.ع</span>
              </div>
              {useWallet && (
                <div className="space-y-1.5 pt-1 border-t border-white/10">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">سيتم خصم</span>
                    <span className="font-bold text-emerald-400">-{formatPrice(walletDeduction)} د.ع</span>
                  </div>
                  {codAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">المتبقي عند الاستلام</span>
                      <span className="font-bold text-foreground">{formatPrice(codAmount)} د.ع</span>
                    </div>
                  )}
                  {codAmount === 0 && (
                    <p className="text-xs text-emerald-400 text-center mt-1">✅ سيتم الدفع بالكامل من المحفظة</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Order Summary */}
          <div className={`${glassCard} p-4 space-y-2`}>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">عدد المنتجات</span>
              <span className="font-bold text-foreground">{itemCount} منتج</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">المجموع الفرعي</span>
              <span className="font-bold text-foreground">{formatPrice(totalAmount)} د.ع</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">التوصيل</span>
              <span className="font-bold text-foreground">{formatPrice(deliveryFee)} د.ع</span>
            </div>
            {walletDeduction > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">خصم المحفظة</span>
                <span className="font-bold text-emerald-400">-{formatPrice(walletDeduction)} د.ع</span>
              </div>
            )}
            <Separator className="bg-white/10" />
            <div className="flex justify-between text-base">
              <span className="font-bold text-foreground">
                {codAmount > 0 ? 'الإجمالي (عند الاستلام)' : 'الإجمالي (مدفوع من المحفظة)'}
              </span>
              <span className="font-black text-primary text-lg">{formatPrice(codAmount)} د.ع</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-bold text-foreground">
              <FileText className="h-4 w-4 text-primary" />
              ملاحظات إضافية (اختياري)
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات خاصة بالطلب..."
              className="resize-none h-20 bg-white/5 border-white/10 backdrop-blur-sm"
            />
          </div>

          {/* Countdown Progress */}
          <div className="space-y-2">
            {!canConfirm && (
              <div className="text-center text-sm text-muted-foreground">
                يرجى مراجعة التفاصيل... <span className="font-bold text-primary">{countdown} ثوانٍ</span>
              </div>
            )}
            <Progress 
              value={progressValue} 
              className="h-2 bg-white/5"
            />
          </div>

          {/* Confirm Button */}
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isProcessing}
            className="w-full h-12 text-base font-black bg-gradient-to-l from-primary to-accent text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all shadow-[0_4px_20px_hsl(var(--primary)/0.25)]"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                جارٍ تأكيد الطلب...
              </>
            ) : canConfirm ? (
              <>
                <CheckCircle2 className="ml-2 h-5 w-5" />
                {codAmount > 0 ? `تأكيد الطلب - ${codAmount === grandTotal ? 'الدفع عند الاستلام' : `دفع ${formatPrice(codAmount)} عند الاستلام`}` : 'تأكيد الطلب - الدفع من المحفظة'}
              </>
            ) : (
              `انتظر ${countdown} ثوانٍ...`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DirectSaleCheckoutDialog;
