/**
 * Merchant Order Dialog - Radically improved UI
 * Features: Commission calculation, payment method selection with warnings
 */
import { useState, useEffect } from 'react';
import { 
  Package, 
  Loader2, 
  AlertTriangle, 
  Wallet, 
  Truck, 
  CreditCard,
  Calculator,
  ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(initialPrice);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [shippingPrice, setShippingPrice] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('full');
  const [partialPaymentPercent, setPartialPaymentPercent] = useState(50);

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setPrice(initialPrice);
      setDescription('');
      setQuantity(1);
      setNotes('');
      setShippingPrice(0);
      setPaymentMethod('full');
      setPartialPaymentPercent(50);
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

  const handleSubmit = () => {
    if (!title.trim() || price <= 0) return;
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

  const isValid = title.trim().length > 0 && price > 0;
  const showWarning = paymentMethod === 'cod' || paymentMethod === 'partial';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b bg-gradient-to-b from-primary/5 to-transparent">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            إنشاء طلب للزبون
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Product Info Section */}
          <div className="space-y-3">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-sm font-medium">
                اسم المنتج/الخدمة <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: طباعة 3D مخصصة"
                className="text-right h-11"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm text-muted-foreground">
                الوصف (اختياري)
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="وصف تفصيلي للمنتج أو الخدمة..."
                className="text-right min-h-[60px] resize-none"
              />
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-3 gap-2">
            {/* Price */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">السعر *</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={price || ''}
                  onChange={(e) => setPrice(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="pl-8 text-right h-10 text-sm"
                  min={0}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  {currency}
                </span>
              </div>
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">الكمية</Label>
              <div className="flex h-10">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-full rounded-l-none px-2"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  -
                </Button>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="text-center h-full rounded-none border-x-0 text-sm"
                  min={1}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-full rounded-r-none px-2"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Shipping */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">التوصيل</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={shippingPrice || ''}
                  onChange={(e) => setShippingPrice(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="pl-8 text-right h-10 text-sm"
                  min={0}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  {currency}
                </span>
              </div>
            </div>
          </div>

          {/* Price Summary - Merchant View */}
          <div className="rounded-xl border bg-gradient-to-br from-muted/50 to-muted/20 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Calculator className="h-3.5 w-3.5" />
              <span>ملخص الأسعار (للتاجر فقط)</span>
            </div>
            
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">المجموع الفرعي</span>
                <span>{subtotal.toLocaleString()} {currency}</span>
              </div>
              {shippingPrice > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">التوصيل</span>
                  <span>{shippingPrice.toLocaleString()} {currency}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t pt-1.5">
                <span className="font-medium">إجمالي الطلب</span>
                <span className="font-bold text-primary">{totalPrice.toLocaleString()} {currency}</span>
              </div>
            </div>

            {/* Commission Display */}
            <div className="mt-2 pt-2 border-t border-dashed">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  عمولة المنصة ({(PLATFORM_COMMISSION_RATE * 100).toFixed(1)}%)
                </span>
                <span className="text-destructive">-{commissionAmount.toLocaleString()} {currency}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="font-medium text-green-600">ستستلم</span>
                <span className="font-bold text-green-600">{merchantReceives.toLocaleString()} {currency}</span>
              </div>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">طريقة الدفع المطلوبة</Label>
            
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              className="grid gap-2"
            >
              {/* Full Payment */}
              <label
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                  paymentMethod === 'full'
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-primary/30"
                )}
              >
                <RadioGroupItem value="full" id="full" className="sr-only" />
                <div className={cn(
                  "p-2 rounded-lg",
                  paymentMethod === 'full' ? "bg-primary/10" : "bg-muted"
                )}>
                  <Wallet className={cn(
                    "h-4 w-4",
                    paymentMethod === 'full' ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">دفع كامل عبر المحفظة</div>
                  <div className="text-xs text-muted-foreground">الأكثر أماناً - حماية كاملة</div>
                </div>
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                  paymentMethod === 'full' ? "border-primary" : "border-muted-foreground/30"
                )}>
                  {paymentMethod === 'full' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  )}
                </div>
              </label>

              {/* Partial Payment */}
              <label
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                  paymentMethod === 'partial'
                    ? "border-amber-500 bg-amber-500/5"
                    : "border-muted hover:border-amber-500/30"
                )}
              >
                <RadioGroupItem value="partial" id="partial" className="sr-only" />
                <div className={cn(
                  "p-2 rounded-lg",
                  paymentMethod === 'partial' ? "bg-amber-500/10" : "bg-muted"
                )}>
                  <CreditCard className={cn(
                    "h-4 w-4",
                    paymentMethod === 'partial' ? "text-amber-500" : "text-muted-foreground"
                  )} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">دفعة مقدمة + عند الاستلام</div>
                  <div className="text-xs text-muted-foreground">جزء عبر المحفظة والباقي نقداً</div>
                </div>
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                  paymentMethod === 'partial' ? "border-amber-500" : "border-muted-foreground/30"
                )}>
                  {paymentMethod === 'partial' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  )}
                </div>
              </label>

              {/* Cash on Delivery */}
              <label
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                  paymentMethod === 'cod'
                    ? "border-orange-500 bg-orange-500/5"
                    : "border-muted hover:border-orange-500/30"
                )}
              >
                <RadioGroupItem value="cod" id="cod" className="sr-only" />
                <div className={cn(
                  "p-2 rounded-lg",
                  paymentMethod === 'cod' ? "bg-orange-500/10" : "bg-muted"
                )}>
                  <Truck className={cn(
                    "h-4 w-4",
                    paymentMethod === 'cod' ? "text-orange-500" : "text-muted-foreground"
                  )} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">الدفع عند الاستلام</div>
                  <div className="text-xs text-muted-foreground">كامل المبلغ نقداً عند التسليم</div>
                </div>
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                  paymentMethod === 'cod' ? "border-orange-500" : "border-muted-foreground/30"
                )}>
                  {paymentMethod === 'cod' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  )}
                </div>
              </label>
            </RadioGroup>

            {/* Partial Payment Slider */}
            {paymentMethod === 'partial' && (
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">نسبة الدفعة المقدمة</span>
                  <span className="font-bold text-amber-600">{partialPaymentPercent}%</span>
                </div>
                <Slider
                  value={[partialPaymentPercent]}
                  onValueChange={(v) => setPartialPaymentPercent(v[0])}
                  min={10}
                  max={90}
                  step={5}
                  className="w-full"
                />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-green-500/10 text-center border border-green-500/20">
                    <div className="text-muted-foreground">يدفع الآن</div>
                    <div className="font-bold text-green-600">{partialAmount.toLocaleString()} {currency}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/10 text-center border border-amber-500/20">
                    <div className="text-muted-foreground">عند الاستلام</div>
                    <div className="font-bold text-amber-600">{remainingAmount.toLocaleString()} {currency}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Warning for COD and Partial */}
            {showWarning && (
              <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription className="text-xs leading-relaxed">
                  <strong className="block mb-1">تنبيه مهم:</strong>
                  المنصة غير مسؤولة عن المبالغ المدفوعة خارج المحفظة ولن توفر حماية للتاجر 
                  في حال حدوث أي خلاف مع الزبون بشأن المبلغ المدفوع {paymentMethod === 'cod' ? 'عند الاستلام' : 'نقداً'}.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ملاحظات للزبون</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات إضافية..."
              className="text-right min-h-[50px] resize-none text-sm"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 pt-0 flex gap-2">
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
            onClick={handleSubmit}
            disabled={isLoading || !isValid}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
