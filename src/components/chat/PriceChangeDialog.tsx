import { useState } from 'react';
import { DollarSign, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface PriceChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPrice: number;
  currency?: string;
  onSubmit: (newPrice: number, reason?: string) => void;
  isLoading?: boolean;
}

export default function PriceChangeDialog({
  open,
  onOpenChange,
  currentPrice,
  currency = 'د.ع',
  onSubmit,
  isLoading = false,
}: PriceChangeDialogProps) {
  const [newPrice, setNewPrice] = useState<string>(currentPrice.toString());
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) return;
    onSubmit(price, reason || undefined);
    setReason('');
  };

  const handleClose = () => {
    onOpenChange(false);
    setNewPrice(currentPrice.toString());
    setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            اقتراح تعديل السعر
          </DialogTitle>
          <DialogDescription>
            سيتم إرسال طلب تعديل السعر للعميل للموافقة عليه
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Price */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-sm text-muted-foreground">السعر الحالي</span>
            <span className="font-bold text-red-500 line-through">
              {currentPrice.toLocaleString()} {currency}
            </span>
          </div>

          {/* New Price */}
          <div className="space-y-2">
            <Label htmlFor="newPrice">السعر الجديد</Label>
            <div className="relative">
              <Input
                id="newPrice"
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="pl-12 text-lg font-bold"
                placeholder="0"
                min={0}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {currency}
              </span>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">سبب التعديل (اختياري)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: إضافة رسوم الشحن، خصم خاص..."
              className="resize-none"
              rows={3}
            />
          </div>

          {/* Preview */}
          {newPrice && parseFloat(newPrice) > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <span className="text-sm text-green-600">السعر المقترح</span>
              <span className="font-bold text-green-600">
                {parseFloat(newPrice).toLocaleString()} {currency}
              </span>
            </div>
          )}
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
            disabled={isLoading || !newPrice || parseFloat(newPrice) <= 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                جاري الإرسال...
              </>
            ) : (
              'إرسال للعميل'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
