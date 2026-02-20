/**
 * Merchant Order Dialog - Professional Redesign
 * Multi-step wizard with clean UI and proper validation
 */
import { useState, useEffect } from 'react';
import { 
  Package, 
  Loader2, 
  Wallet, 
  Truck, 
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Check,
  Info,
  Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// Commission rate - configurable by admin (currently 0.7%)
const PLATFORM_COMMISSION_RATE = 0.007;

type PaymentMethod = 'full' | 'partial' | 'cod';

interface MerchantOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    title: string;
    description: string;
    price: number;
    quantity: number;
    notes: string;
    shippingPrice: number;
    paymentMethod: PaymentMethod;
    partialPaymentPercent: number;
  }) => void;
  isLoading?: boolean;
  currency?: string;
  initialTitle?: string;
  initialPrice?: number;
  initialImage?: string;
}

export default function MerchantOrderDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  currency = 'د.ع',
  initialTitle = '',
  initialPrice = 0,
  initialImage,
}: MerchantOrderDialogProps) {
  // Form State
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(initialPrice);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [shippingPrice, setShippingPrice] = useState<number>(5000);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('full');
  const [partialPaymentPercent, setPartialPaymentPercent] = useState(50);
  const [acceptedWarning, setAcceptedWarning] = useState(false);
  
  // Wizard State
  const [step, setStep] = useState(1);
  const totalSteps = 2;

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setPrice(initialPrice);
      setDescription('');
      setQuantity(1);
      setNotes('');
      setShippingPrice(5000);
      setPaymentMethod('full');
      setPartialPaymentPercent(50);
      setAcceptedWarning(false);
      setStep(1);
    }
  }, [open, initialTitle, initialPrice]);

  // Calculations
  const subtotal = price * quantity;
  const totalPrice = subtotal + shippingPrice;
  const commissionAmount = Math.round(totalPrice * PLATFORM_COMMISSION_RATE);
  const merchantReceives = totalPrice - commissionAmount;
  
  // Partial payment calculations
  const partialAmount = Math.round(totalPrice * (partialPaymentPercent / 100));
  const remainingAmount = totalPrice - partialAmount;

  // Validation
  const isStep1Valid = title.trim().length >= 3 && price > 0;
  const needsWarningAcceptance = paymentMethod === 'cod' || paymentMethod === 'partial';
  const isStep2Valid = !needsWarningAcceptance || acceptedWarning;
  const canSubmit = isStep1Valid && isStep2Valid;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      price,
      quantity,
      notes: notes.trim(),
      shippingPrice,
      paymentMethod,
      partialPaymentPercent: paymentMethod === 'partial' ? partialPaymentPercent : 0,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const nextStep = () => {
    if (step < totalSteps && isStep1Valid) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Reset warning acceptance when payment method changes
  useEffect(() => {
    setAcceptedWarning(false);
  }, [paymentMethod]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden p-0 gap-0">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center shadow-sm">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base">إنشاء طلب مخصص</h2>
              <p className="text-[11px] text-muted-foreground">
                الخطوة {step} من {totalSteps}
              </p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/50">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Step 1: Product Details */}
          {step === 1 && (
            <div className="p-4 space-y-4">
              {/* Product Preview (if image exists) */}
              {initialImage && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 border">
                  <img
                    src={initialImage}
                    alt={title || 'المنتج'}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">صورة المنتج</p>
                    <p className="text-sm font-medium truncate">{title || 'منتج جديد'}</p>
                  </div>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1">
                  اسم المنتج/الخدمة
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: طباعة 3D مخصصة"
                  className="h-11 text-right"
                />
                {title.length > 0 && title.length < 3 && (
                  <p className="text-[10px] text-destructive">الاسم قصير جداً (3 أحرف على الأقل)</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">الوصف (اختياري)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف تفصيلي للمنتج أو الخدمة..."
                  className="text-right min-h-[60px] resize-none text-sm"
                />
              </div>

              {/* Price & Quantity Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Price */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    السعر <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={price || ''}
                      onChange={(e) => setPrice(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="0"
                      className="pl-10 text-right h-11"
                      min={0}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {currency}
                    </span>
                  </div>
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">الكمية</Label>
                  <div className="flex h-11">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-full rounded-l-none px-3 border-r-0"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                    >
                      -
                    </Button>
                    <Input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="text-center h-full rounded-none flex-1"
                      min={1}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-full rounded-r-none px-3 border-l-0"
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>

              {/* Shipping */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">تكلفة التوصيل (اختياري)</Label>
                <div className="relative">
                  <Truck className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    value={shippingPrice || ''}
                    onChange={(e) => setShippingPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0"
                    className="pr-10 pl-10 text-right h-11"
                    min={0}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {currency}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">ملاحظات للزبون</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي تفاصيل إضافية..."
                  className="text-right min-h-[50px] resize-none text-sm"
                />
              </div>
            </div>
          )}

          {/* Step 2: Payment Method */}
          {step === 2 && (
            <div className="p-4 space-y-4">
              {/* Order Summary */}
              <div className="rounded-xl border bg-gradient-to-br from-card to-muted/20 p-3.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <Package className="h-3.5 w-3.5" />
                  <span>ملخص الطلب</span>
                </div>
                
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{title}</span>
                    <span>×{quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المجموع الفرعي</span>
                    <span>{subtotal.toLocaleString()} {currency}</span>
                  </div>
                  {shippingPrice > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">التوصيل</span>
                      <span>{shippingPrice.toLocaleString()} {currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t font-bold">
                    <span>الإجمالي</span>
                    <span className="text-primary text-base">{totalPrice.toLocaleString()} {currency}</span>
                  </div>
                </div>

                {/* Commission Info - Merchant only */}
                <div className="mt-3 pt-2.5 border-t border-dashed space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">عمولة المنصة ({(PLATFORM_COMMISSION_RATE * 100).toFixed(1)}%)</span>
                    <span className="text-destructive">-{commissionAmount.toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-emerald-600">ستستلم</span>
                    <span className="font-bold text-emerald-600">{merchantReceives.toLocaleString()} {currency}</span>
                  </div>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">طريقة الدفع</Label>
                
                <div className="grid gap-2">
                  {/* Full Payment - Recommended */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('full')}
                    className={cn(
                      "relative flex items-center gap-3 p-3 rounded-xl border-2 text-right transition-all",
                      paymentMethod === 'full'
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-primary/40 hover:bg-muted/30"
                    )}
                  >
                    {paymentMethod === 'full' && (
                      <div className="absolute top-2 left-2">
                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                      paymentMethod === 'full' ? "bg-primary/15" : "bg-muted"
                    )}>
                      <Wallet className={cn(
                        "h-5 w-5",
                        paymentMethod === 'full' ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">دفع كامل عبر المحفظة</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">
                          موصى
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                        <ShieldCheck className="h-3 w-3 text-emerald-500" />
                        <span>حماية كاملة للتاجر والعميل</span>
                      </div>
                    </div>
                  </button>

                  {/* Partial Payment */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('partial')}
                    className={cn(
                      "relative flex items-center gap-3 p-3 rounded-xl border-2 text-right transition-all",
                      paymentMethod === 'partial'
                        ? "border-amber-500 bg-amber-500/5"
                        : "border-muted hover:border-amber-500/40 hover:bg-muted/30"
                    )}
                  >
                    {paymentMethod === 'partial' && (
                      <div className="absolute top-2 left-2">
                        <div className="h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      </div>
                    )}
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                      paymentMethod === 'partial' ? "bg-amber-500/15" : "bg-muted"
                    )}>
                      <CreditCard className={cn(
                        "h-5 w-5",
                        paymentMethod === 'partial' ? "text-amber-600" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">دفعة مقدمة</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        جزء عبر المحفظة والباقي نقداً
                      </p>
                    </div>
                  </button>

                  {/* COD */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cod')}
                    className={cn(
                      "relative flex items-center gap-3 p-3 rounded-xl border-2 text-right transition-all",
                      paymentMethod === 'cod'
                        ? "border-orange-500 bg-orange-500/5"
                        : "border-muted hover:border-orange-500/40 hover:bg-muted/30"
                    )}
                  >
                    {paymentMethod === 'cod' && (
                      <div className="absolute top-2 left-2">
                        <div className="h-5 w-5 rounded-full bg-orange-500 flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      </div>
                    )}
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                      paymentMethod === 'cod' ? "bg-orange-500/15" : "bg-muted"
                    )}>
                      <Truck className={cn(
                        "h-5 w-5",
                        paymentMethod === 'cod' ? "text-orange-600" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">الدفع عند الاستلام</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        كامل المبلغ نقداً عند التسليم
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Partial Payment Slider */}
              {paymentMethod === 'partial' && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-amber-700">نسبة الدفعة المقدمة</span>
                    <span className="font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      {partialPaymentPercent}%
                    </span>
                  </div>
                  <Slider
                    value={[partialPaymentPercent]}
                    onValueChange={(v) => setPartialPaymentPercent(v[0])}
                    min={10}
                    max={90}
                    step={5}
                    className="w-full"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-emerald-100 border border-emerald-200 text-center">
                      <p className="text-[10px] text-emerald-600 font-medium">يدفع الآن</p>
                      <p className="font-bold text-emerald-700">{partialAmount.toLocaleString()} {currency}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-100 border border-amber-200 text-center">
                      <p className="text-[10px] text-amber-600 font-medium">عند الاستلام</p>
                      <p className="font-bold text-amber-700">{remainingAmount.toLocaleString()} {currency}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Warning for non-wallet payments */}
              {needsWarningAcceptance && (
                <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3.5 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium text-sm text-destructive">تنبيه مهم</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        المنصة غير مسؤولة عن المبالغ المدفوعة خارج المحفظة. 
                        لن يتم توفير حماية للتاجر في حال حدوث أي خلاف بشأن المبلغ 
                        المدفوع {paymentMethod === 'cod' ? 'عند الاستلام' : 'نقداً'}.
                      </p>
                    </div>
                  </div>
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={acceptedWarning}
                      onCheckedChange={(checked) => setAcceptedWarning(!!checked)}
                    />
                    <span className="text-xs font-medium">
                      أفهم وأتحمل المسؤولية الكاملة
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30 flex gap-2">
          {step === 1 ? (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={isLoading}
              >
                إلغاء
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={nextStep}
                disabled={!isStep1Valid}
              >
                التالي
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={prevStep}
                disabled={isLoading}
              >
                <ChevronRight className="h-4 w-4" />
                السابق
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleSubmit}
                disabled={isLoading || !canSubmit}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4" />
                    إرسال الطلب
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
