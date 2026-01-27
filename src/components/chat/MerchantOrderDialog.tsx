/**
 * Merchant Order Dialog - Allows merchants to create custom orders
 * with price, quantity, description, and partial payment options
 */
import { useState } from 'react';
import { Package, Loader2, Percent, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MerchantOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    title: string;
    description: string;
    price: number;
    quantity: number;
    requirePartialPayment: boolean;
    partialPaymentPercent: number;
  }) => void;
  isLoading?: boolean;
  currency?: string;
}

export default function MerchantOrderDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  currency = 'د.ع',
}: MerchantOrderDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [quantity, setQuantity] = useState(1);
  const [requirePartialPayment, setRequirePartialPayment] = useState(false);
  const [partialPaymentPercent, setPartialPaymentPercent] = useState(50);

  const totalPrice = price * quantity;
  const partialAmount = Math.round(totalPrice * (partialPaymentPercent / 100));
  const remainingAmount = totalPrice - partialAmount;

  const handleSubmit = () => {
    if (!title.trim() || price <= 0) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      price,
      quantity,
      requirePartialPayment,
      partialPaymentPercent: requirePartialPayment ? partialPaymentPercent : 0,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset form
    setTitle('');
    setDescription('');
    setPrice(0);
    setQuantity(1);
    setRequirePartialPayment(false);
    setPartialPaymentPercent(50);
  };

  const isValid = title.trim().length > 0 && price > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            إنشاء طلب للزبون
          </DialogTitle>
          <DialogDescription>
            أنشئ طلباً مخصصاً وأرسله للزبون للموافقة والدفع
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Product Title */}
          <div className="space-y-2">
            <Label htmlFor="title">اسم المنتج/الخدمة *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: طباعة 3D مخصصة"
              className="text-right"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">الوصف (اختياري)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف تفصيلي للمنتج أو الخدمة..."
              className="text-right min-h-[80px]"
            />
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price">السعر *</Label>
            <div className="relative">
              <Input
                id="price"
                type="number"
                value={price || ''}
                onChange={(e) => setPrice(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
                className="pl-12 text-right"
                min={0}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {currency}
              </span>
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">الكمية</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                -
              </Button>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="text-center w-20"
                min={1}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantity(quantity + 1)}
              >
                +
              </Button>
            </div>
          </div>

          {/* Total Display */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-sm font-medium">الإجمالي</span>
            <span className="font-bold text-lg text-primary">
              {totalPrice.toLocaleString()} {currency}
            </span>
          </div>

          {/* Partial Payment Option */}
          <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-amber-500" />
                <Label htmlFor="partial-payment" className="cursor-pointer">
                  طلب دفعة مقدمة
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">يُضاف 5% عمولة على الدفعات الجزئية</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Switch
                id="partial-payment"
                checked={requirePartialPayment}
                onCheckedChange={setRequirePartialPayment}
              />
            </div>

            {requirePartialPayment && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">نسبة الدفعة المقدمة</span>
                  <span className="font-bold text-primary">{partialPaymentPercent}%</span>
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
                  <div className="p-2 rounded bg-green-500/10 text-center">
                    <div className="text-muted-foreground">يدفع الآن</div>
                    <div className="font-bold text-green-600">{partialAmount.toLocaleString()} {currency}</div>
                  </div>
                  <div className="p-2 rounded bg-amber-500/10 text-center">
                    <div className="text-muted-foreground">عند الاستلام</div>
                    <div className="font-bold text-amber-600">{remainingAmount.toLocaleString()} {currency}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            سيتم إرسال الطلب للزبون للموافقة عليه وإتمام الدفع
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleClose}
            disabled={isLoading}
          >
            إلغاء
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={isLoading || !isValid}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                جاري الإرسال...
              </>
            ) : (
              'إرسال الطلب'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}