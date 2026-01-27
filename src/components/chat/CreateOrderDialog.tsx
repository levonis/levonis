import { useState } from 'react';
import { Package, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productTitle: string;
  productImage?: string;
  productPrice: number;
  currency?: string;
  onSubmit: (quantity: number) => void;
  isLoading?: boolean;
}

export default function CreateOrderDialog({
  open,
  onOpenChange,
  productId,
  productTitle,
  productImage,
  productPrice,
  currency = 'د.ع',
  onSubmit,
  isLoading = false,
}: CreateOrderDialogProps) {
  const [quantity, setQuantity] = useState(1);

  const totalPrice = productPrice * quantity;

  const handleSubmit = () => {
    if (quantity < 1) return;
    onSubmit(quantity);
  };

  const handleClose = () => {
    onOpenChange(false);
    setQuantity(1);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            إنشاء طلب
          </DialogTitle>
          <DialogDescription>
            حدد الكمية لإنشاء طلب جديد
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Product Preview */}
          <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border">
            {productImage ? (
              <img
                src={productImage}
                alt={productTitle}
                className="h-16 w-16 rounded-lg object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                <Package className="h-6 w-6 text-muted-foreground/30" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm line-clamp-2">{productTitle}</h4>
              <p className="text-primary font-bold mt-1">
                {productPrice.toLocaleString()} {currency}
              </p>
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

          {/* Total */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-sm font-medium">الإجمالي</span>
            <span className="font-bold text-lg text-primary">
              {totalPrice.toLocaleString()} {currency}
            </span>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            سيتم إنشاء الطلب ويمكن للتاجر تأكيده أو تعديل السعر قبل الدفع
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
            disabled={isLoading || quantity < 1}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                جاري الإنشاء...
              </>
            ) : (
              'إنشاء الطلب'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
